import { prisma } from "../db";

// 8.3 - creates an in-app notification. Real push delivery is future work
// (needs Expo push tokens + a delivery worker); for now everything lands in
// the in-app Notification Centre, which per 10.11 must work regardless.
export async function notifyUser(userId: string, type: string, title: string, body: string, extra?: Record<string, unknown>) {
  await prisma.notification.create({
    data: { userId, type, payload: JSON.stringify({ title, body, ...extra }) },
  });
}

export async function notifyGroupMembers(
  groupId: string,
  type: string,
  title: string,
  body: string,
  options?: { excludeUserId?: string; onlyUserIds?: string[]; extra?: Record<string, unknown> }
) {
  const members = await prisma.groupMember.findMany({ where: { groupId, status: "ACTIVE" } });
  const targetIds = options?.onlyUserIds
    ? members.filter((m) => options.onlyUserIds!.includes(m.userId)).map((m) => m.userId)
    : members.map((m) => m.userId);

  await Promise.all(
    targetIds
      .filter((id) => id !== options?.excludeUserId)
      .map((id) => notifyUser(id, type, title, body, { groupId, ...options?.extra }))
  );
}

// 5.9 - system messages appear inline in the group chat alongside normal messages.
export async function postSystemMessage(groupId: string, text: string) {
  await prisma.groupChatMessage.create({ data: { groupId, isSystem: true, text } });
}
