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
