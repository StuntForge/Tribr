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
    diagnosePushNotifications().then((result) => {
      if (!result.success) {
        const failed = result.steps.find((s) => !s.ok);
        console.warn("Push registration failed at step:", failed?.label, failed?.detail);
      }
    });
  }, [enabled]);
}

export interface PushDiagnosticStep {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface PushDiagnosticResult {
  success: boolean;
  steps: PushDiagnosticStep[];
}

// Runs the same registration flow as the silent background version above,
// but reports each step's outcome instead of swallowing failures. A
// production build has no visible console, so this is what backs the
// manual "Check push notifications" button in Profile - it turns an
// invisible failure into something the user can read and report back.
export async function diagnosePushNotifications(): Promise<PushDiagnosticResult> {
  const steps: PushDiagnosticStep[] = [];

  if (!Device.isDevice) {
    steps.push({ label: "Physical device", ok: false, detail: "This is a simulator/emulator - push only works on a real phone." });
    return { success: false, steps };
  }
  steps.push({ label: "Physical device", ok: true });

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      steps.push({ label: "Notification channel", ok: true });
    } catch (e: any) {
      steps.push({ label: "Notification channel", ok: false, detail: e?.message ?? String(e) });
      return { success: false, steps };
    }
  }

  let finalStatus: string;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    steps.push({ label: "Permission", ok: finalStatus === "granted", detail: finalStatus });
    if (finalStatus !== "granted") return { success: false, steps };
  } catch (e: any) {
    steps.push({ label: "Permission", ok: false, detail: e?.message ?? String(e) });
    return { success: false, steps };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  steps.push({ label: "App project ID", ok: Boolean(projectId), detail: projectId ?? "missing" });
  if (!projectId) return { success: false, steps };

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
    steps.push({ label: "Get push token", ok: true, detail: `${token.slice(0, 24)}…` });
  } catch (e: any) {
    steps.push({ label: "Get push token", ok: false, detail: e?.message ?? String(e) });
    return { success: false, steps };
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await registerPushToken(token, timezone);
    steps.push({ label: "Save to server", ok: true });
  } catch (e: any) {
    steps.push({ label: "Save to server", ok: false, detail: e?.message ?? String(e) });
    return { success: false, steps };
  }

  return { success: true, steps };
}
