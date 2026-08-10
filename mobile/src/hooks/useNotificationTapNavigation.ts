import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { navigationRef } from "../navigation/navigationRef";
import { resolveNotificationRoute } from "../utils/notificationNav";

function navigateToRoute(data: Record<string, unknown> | undefined) {
  const route = resolveNotificationRoute(data?.type as string | undefined, data as any);
  if (!route) return;

  const go = () =>
    (navigationRef.navigate as any)(route.tab, route.screen ? { screen: route.screen, params: route.params } : undefined);

  // Cold start: the tap that launched the app can fire before
  // NavigationContainer has finished mounting, so give it one short retry.
  if (navigationRef.isReady()) go();
  else setTimeout(go, 300);
}

// Handles tapping a push notification, both while the app is already
// running and as the tap that launched it from a killed state.
export function useNotificationTapNavigation() {
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) navigateToRoute(response.notification.request.content.data as Record<string, unknown>);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToRoute(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => subscription.remove();
  }, []);
}
