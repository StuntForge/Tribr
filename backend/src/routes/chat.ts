import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  return Boolean(member && member.status === "ACTIVE");
}

// 5.8 - the group's dedicated chat, available for the group's whole lifetime.
router.get("/groups/:id/messages", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can view this chat." });

  const messages = await prisma.groupChatMessage.findMany({
    where: { groupId: req.params.id },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Viewing the chat marks it read - this is the only place that happens,
  // so opening the screen (it polls this endpoint) is what clears the badge.
  await prisma.groupChatRead.upsert({
    where: { groupId_userId: { groupId: req.params.id, userId: req.userId! } },
    create: { groupId: req.params.id, userId: req.userId! },
    update: { lastReadAt: new Date() },
  });

  res.json(
    messages.map((m) => ({
      id: m.id,
      isSystem: m.isSystem,
      senderId: m.senderId,
      senderName: m.sender?.firstName ?? null,
      text: m.text,
      photoUrl: m.photoUrl,
      createdAt: m.createdAt,
    }))
  );
});

// Powers the Groups tab badge and the Home screen's Messages section - one
// group with 12 unread messages still counts as 1 group with unread messages.
router.get("/me/unread-messages", async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId, status: "ACTIVE", group: { state: { notIn: ["DISBANDED"] } } },
    include: { group: true },
  });
  if (memberships.length === 0) return res.json([]);

  const reads = await prisma.groupChatRead.findMany({
    where: { userId: req.userId, groupId: { in: memberships.map((m) => m.groupId) } },
  });
  const readAtByGroup = new Map(reads.map((r) => [r.groupId, r.lastReadAt]));

  const results = [];
  for (const m of memberships) {
    const since = readAtByGroup.get(m.groupId) ?? m.joinedAt;
    const unreadCount = await prisma.groupChatMessage.count({
      where: { groupId: m.groupId, createdAt: { gt: since }, senderId: { not: req.userId } },
    });
    if (unreadCount > 0) {
      results.push({ groupId: m.groupId, groupName: m.group.name, unreadCount });
    }
  }
  res.json(results);
});

router.post("/groups/:id/messages", async (req, res) => {
  const isMember = await requireGroupMember(req.params.id, req.userId!);
  if (!isMember) return res.status(403).json({ error: "Only group members can post here." });

  const text = req.body.text ? String(req.body.text).trim() : null;
  const photoUrl = req.body.photoUrl ? String(req.body.photoUrl).trim() : null;
  if (!text && !photoUrl) return res.status(400).json({ error: "Message can't be empty." });

  const message = await prisma.groupChatMessage.create({
    data: { groupId: req.params.id, senderId: req.userId, text, photoUrl },
    include: { sender: true },
  });

  res.status(201).json({
    id: message.id,
    isSystem: false,
    senderId: message.senderId,
    senderName: message.sender?.firstName ?? null,
    text: message.text,
    photoUrl: message.photoUrl,
    createdAt: message.createdAt,
  });
});

export default router;
