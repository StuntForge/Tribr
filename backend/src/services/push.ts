import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "../db";

const expo = new Expo();

export interface PushSendResult {
  sent: number;
  errors: string[];
}

// Best-effort - a push failure (bad/expired token, Expo outage) should never
// break the request that triggered the notification. Errors are swallowed
// after logging. Callers that need to know whether delivery actually
// succeeded (e.g. the admin "send test push" diagnostic) can use the
// returned PushSendResult instead.
export async function sendPush(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } });
  if (!user?.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
    return { sent: 0, errors: ["This user has no registered push token."] };
  }
  return sendPushToTokens([user.expoPushToken], title, body, data);
}

export async function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
  if (userIds.length === 0) return { sent: 0, errors: [] };
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, expoPushToken: { not: null } },
    select: { expoPushToken: true },
  });
  const tokens = users.map((u) => u.expoPushToken!).filter((t) => Expo.isExpoPushToken(t));
  return sendPushToTokens(tokens, title, body, data);
}

async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<PushSendResult> {
  if (tokens.length === 0) return { sent: 0, errors: [] };
  const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, sound: "default", title, body, data }));
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  const errors: string[] = [];
  for (const chunk of chunks) {
    try {
      tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
    } catch (e: any) {
      console.error("Push send failed for a chunk:", e);
      errors.push(e?.message ?? String(e));
    }
  }
  let sent = 0;
  for (const ticket of tickets) {
    if (ticket.status === "ok") {
      sent++;
    } else {
      const detail = ticket.details?.error ? `${ticket.details.error} - ${ticket.message}` : ticket.message;
      console.error("Push delivery ticket error:", detail);
      errors.push(detail ?? "Unknown delivery error");
    }
  }
  return { sent, errors };
}
