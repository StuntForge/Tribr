import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NotificationsScreen from "../screens/NotificationsScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export default function NotificationsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="NotificationsHome" component={NotificationsScreen} options={{ title: "Notifications" }} />
    </Stack.Navigator>
  );
}
