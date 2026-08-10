import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { registerPushToken } from "../api/notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Registers (or re-registers - tokens can change) this device's Expo push
// token plus its IANA timezone once the user is authenticated. Runs once per
// app session; a fresh install/app open re-runs it, which is how a changed
// token or timezone (e.g. travel) stays current server-side.
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    register().catch((e) => console.warn("Push registration failed:", e));
  }, [enabled]);
}

async function register() {
  if (!Device.isDevice) return; // push tokens aren't meaningful on simulators/emulators

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await registerPushToken(token, timezone);
}
