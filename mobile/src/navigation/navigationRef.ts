import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside the navigator tree (the push-notification tap handler)
// trigger navigation without needing a `navigation` prop.
export const navigationRef = createNavigationContainerRef();
