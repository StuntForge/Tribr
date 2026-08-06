import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileStack from "./ProfileStack";
import GroupsStack from "./GroupsStack";
import SearchStack from "./SearchStack";
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
      <Tab.Screen name="Search" component={SearchStack} options={{ headerShown: false }} />
      <Tab.Screen name="Groups" component={GroupsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
