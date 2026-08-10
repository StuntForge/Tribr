import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../db";

const expo = new Expo();

// Best-effort - a push failure (bad/expired token, Expo outage) should never
// break the request that triggered the notification. Errors are swallowed
// after logging.
export async function sendPush(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } });
  if (!user?.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) return;
  await sendPushToTokens([user.expoPushToken], title, body, data);
}

export async function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
  if (userIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, expoPushToken: { not: null } },
    select: { expoPushToken: true },
  });
  const tokens = users.map((u) => u.expoPushToken!).filter((t) => Expo.isExpoPushToken(t));
  await sendPushToTokens(tokens, title, body, data);
}

async function sendPushToTokens(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  if (tokens.length === 0) return;
  const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, sound: "default", title, body, data }));
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error("Push send failed for a chunk:", e);
    }
  }
}
