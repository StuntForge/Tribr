import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdminAuth, logAdminAction } from "../middleware/adminAuth";
import { signAdminToken } from "../services/adminJwt";
import { runFullSpectrumSeed, deleteDemoData, deleteUserAccount } from "../services/demoData";
import { sendPushToUsers } from "../services/push";

const router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!admin) return res.status(401).json({ error: "Invalid email or password." });

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password." });

  const token = signAdminToken({ adminId: admin.id });
  res.json({ token, admin: { id: admin.id, email: admin.email, role: admin.role } });
});

router.use(requireAdminAuth);

router.get("/me", async (req, res) => {
  const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.adminId } });
  res.json({ id: admin.id, email: admin.email, role: admin.role });
});

// ---------- Analytics (8.10) ----------

router.get("/analytics", async (_req, res) => {
  const [activeUsers, activeGroups, completedTasks, subscriberCount, totalUsers, openReports] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.group.count({ where: { state: { in: ["RECRUITING", "READY", "WORKING"] } } }),
    prisma.task.count({ where: { status: "ARCHIVED" } }),
    prisma.user.count({ where: { subscriptionTier: "SUBSCRIBER" } }),
    prisma.user.count(),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);

  const completedCycles = await prisma.groupCycle.findMany({ where: { completedAt: { not: null } } });
  const avgCompletionHours =
    completedCycles.length > 0
      ? completedCycles
          .filter((c) => c.startedAt)
          .reduce((sum, c) => sum + (c.completedAt!.getTime() - c.startedAt!.getTime()) / (1000 * 60 * 60), 0) /
        completedCycles.filter((c) => c.startedAt).length
      : null;

  res.json({
    activeUsers,
    totalUsers,
    activeGroups,
    completedTasks,
    completedCycles: completedCycles.length,
    subscriberCount,
    openReports,
    avgCompletionHours: avgCompletionHours != null ? Math.round(avgCompletionHours * 10) / 10 : null,
  });
});

// ---------- User management (8.9) ----------

router.get("/users", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const users = await prisma.user.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query ? { OR: [{ firstName: { contains: query } }, { phone: { contains: query } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const reportCounts = await prisma.report.groupBy({
    by: ["reportedUserId"],
    where: { reportedUserId: { in: users.map((u) => u.id) } },
    _count: true,
  });
  const reportCountByUser = new Map(reportCounts.map((r) => [r.reportedUserId, r._count]));

  res.json(
    users.map((u) => ({
      id: u.id,
      phone: u.phone,
      firstName: u.firstName,
      status: u.status,
      subscriptionTier: u.subscriptionTier,
      createdAt: u.createdAt,
      reportCount: reportCountByUser.get(u.id) ?? 0,
    }))
  );
});

router.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      memberships: { include: { group: true } },
      reportsReceived: { include: { reporter: true } },
      reportsMade: true,
      subscription: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found." });

  res.json({
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    age: user.age,
    gender: user.gender,
    status: user.status,
    subscriptionTier: user.subscriptionTier,
    createdAt: user.createdAt,
    groups: user.memberships.map((m) => ({ id: m.group.id, name: m.group.name, state: m.group.state, isLeader: m.isLeader })),
    reportsReceived: user.reportsReceived.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      reporterName: r.reporter.firstName,
      createdAt: r.createdAt,
    })),
    reportsMadeCount: user.reportsMade.length,
    subscription: user.subscription ? { status: user.subscription.status, currentPeriodEnd: user.subscription.currentPeriodEnd } : null,
  });
});

const moderationSchema = z.object({ reason: z.string().min(1).max(500) });

router.post("/users/:id/suspend", async (req, res) => {
  const parsed = moderationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: "SUSPENDED" } });
  await logAdminAction(req.adminId!, "SUSPEND_USER", "User", user.id, parsed.data.reason);
  res.json({ ok: true });
});

router.post("/users/:id/ban", async (req, res) => {
  const parsed = moderationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: "BANNED" } });
  await logAdminAction(req.adminId!, "BAN_USER", "User", user.id, parsed.data.reason);
  res.json({ ok: true });
});

router.post("/users/:id/reinstate", async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: "ACTIVE" } });
  await logAdminAction(req.adminId!, "REINSTATE_USER", "User", user.id);
  res.json({ ok: true });
});

// Permanently removes an account and everything it owns (tasks, group
// membership, ratings, etc). Unlike suspend/ban this can't be undone, so it
// logs the target's phone number in the audit trail since the user row
// itself won't exist afterward to look up.
router.delete("/users/:id", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { phone: true, firstName: true } });
  if (!target) return res.status(404).json({ error: "User not found." });

  const result = await deleteUserAccount(req.params.id);
  if (!result.ok) return res.status(400).json({ error: result.error });

  await logAdminAction(req.adminId!, "DELETE_USER", "User", req.params.id, `${target.firstName ?? "Unnamed"} (${target.phone})`);
  res.json({ ok: true });
});

// ---------- Reports (8.8/8.9) ----------

router.get("/reports", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "OPEN";
  const reports = await prisma.report.findMany({
    where: { status },
    include: { reporter: true, reportedUser: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(
    reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      reporterName: r.reporter.firstName,
      reportedUserId: r.reportedUserId,
      reportedUserName: r.reportedUser?.firstName ?? null,
      createdAt: r.createdAt,
    }))
  );
});

const resolveReportSchema = z.object({ status: z.enum(["RESOLVED", "DISMISSED"]), notes: z.string().max(500).optional() });

router.post("/reports/:id/resolve", async (req, res) => {
  const parsed = resolveReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const report = await prisma.report.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
  await logAdminAction(req.adminId!, `REPORT_${parsed.data.status}`, "Report", report.id, parsed.data.notes);
  res.json({ ok: true });
});

// ---------- Subscriptions (8.5) ----------

router.get("/subscriptions", async (_req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: { user: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  res.json(
    subscriptions.map((s) => ({
      userId: s.userId,
      userName: s.user.firstName,
      userPhone: s.user.phone,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd,
    }))
  );
});

// ---------- Job categories (3.3, system configuration) ----------

router.get("/job-categories", async (_req, res) => {
  const categories = await prisma.jobCategory.findMany({ orderBy: { name: "asc" } });
  res.json(categories);
});

const categorySchema = z.object({ name: z.string().min(1).max(50) });

router.post("/job-categories", async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const category = await prisma.jobCategory.create({ data: { name: parsed.data.name } });
  await logAdminAction(req.adminId!, "CREATE_CATEGORY", "JobCategory", category.id, category.name);
  res.status(201).json(category);
});

const updateCategorySchema = z.object({ name: z.string().min(1).max(50).optional(), active: z.boolean().optional() });

router.patch("/job-categories/:id", async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const category = await prisma.jobCategory.update({ where: { id: req.params.id }, data: parsed.data });
  await logAdminAction(req.adminId!, "UPDATE_CATEGORY", "JobCategory", category.id, JSON.stringify(parsed.data));
  res.json(category);
});

// ---------- Broadcast announcements ----------

const broadcastSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

router.post("/broadcast", async (req, res) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const users = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: "ANNOUNCEMENT",
      payload: JSON.stringify({ title: parsed.data.title, body: parsed.data.body }),
    })),
  });
  await sendPushToUsers(
    users.map((u) => u.id),
    parsed.data.title,
    parsed.data.body,
    { type: "ANNOUNCEMENT" }
  );

  await logAdminAction(req.adminId!, "BROADCAST_SENT", "User", undefined, `"${parsed.data.title}" to ${users.length} users`);
  res.json({ ok: true, recipientCount: users.length });
});

// ---------- Demo data (full-spectrum seed) ----------

router.post("/seed-full-spectrum", async (req, res) => {
  try {
    const result = await runFullSpectrumSeed();
    await logAdminAction(
      req.adminId!,
      "DEMO_DATA_SEEDED",
      "User",
      undefined,
      `${result.usersCreated} users, ${result.groupsCreated} groups`
    );
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Seed failed." });
  }
});

router.post("/delete-demo-data", async (req, res) => {
  try {
    const result = await deleteDemoData();
    await logAdminAction(
      req.adminId!,
      "DEMO_DATA_DELETED",
      "User",
      undefined,
      `${result.usersDeleted} users, ${result.groupsDeleted} groups (${result.protectedUsers} protected users skipped)`
    );
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Delete failed." });
  }
});

// ---------- Audit log (8.11) ----------

router.get("/audit-log", async (_req, res) => {
  const logs = await prisma.adminAuditLog.findMany({
    include: { admin: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  res.json(
    logs.map((l) => ({
      id: l.id,
      adminEmail: l.admin.email,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      details: l.details,
      createdAt: l.createdAt,
    }))
  );
});

export default router;
