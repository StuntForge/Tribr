import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import PlaceholderScreen from "../screens/PlaceholderScreen";
import ProfileStack from "./ProfileStack";
import { colors } from "../theme";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home",
            Search: "search",
            Groups: "people",
            Notifications: "notifications",
            Profile: "person-circle",
          };
          return <Ionicons name={icons[route.name] ?? "ellipse"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search">
        {() => (
          <PlaceholderScreen
            title="Search is coming soon"
            body="Browsing and filtering groups and members arrives in the next milestone."
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Groups">
        {() => (
          <PlaceholderScreen
            title="No groups yet"
            body="Once you can create a personal task, you'll be able to create or join a group here."
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Notifications">
        {() => (
          <PlaceholderScreen
            title="Nothing here yet"
            body="You'll see invitations, approvals and reminders in this tab once groups are enabled."
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
