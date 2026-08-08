import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import NotificationsStack from "./NotificationsStack";
import ProfileStack from "./ProfileStack";
import GroupsStack from "./GroupsStack";
import TasksStack from "./TasksStack";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import { colors, radii } from "../theme";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const { data: unreadMessages } = useUnreadMessages();
  const unreadGroupCount = unreadMessages?.length ?? 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" as const },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.6)",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" as const },
        tabBarStyle: {
          backgroundColor: colors.primaryDark,
          borderTopWidth: 0,
          height: 62 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom + 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home",
            Groups: "people",
            Tasks: "hammer",
            Notifications: "notifications",
            Profile: "settings",
          };
          return (
            <View>
              <View
                style={
                  focused
                    ? {
                        backgroundColor: colors.accent,
                        borderRadius: radii.pill,
                        width: 40,
                        height: 30,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: -14,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 6,
                      }
                    : undefined
                }
              >
                <Ionicons name={icons[route.name] ?? "ellipse"} size={focused ? size : size - 2} color={focused ? "#fff" : color} />
              </View>
              {route.name === "Groups" && unreadGroupCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{unreadGroupCount > 9 ? "9+" : unreadGroupCount}</Text>
                </View>
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Groups"
        component={GroupsStack}
        options={({ route }) => {
          // Group Chat hides the tab bar to reclaim space for the keyboard.
          // Critically: the "normal" branch must NOT include tabBarStyle at
          // all (not even `undefined`) - explicitly setting a key, even to
          // undefined, overrides the navigator's screenOptions default
          // instead of falling back to it, which is what left the tab bar
          // permanently broken after leaving chat.
          const focusedRoute = getFocusedRouteNameFromRoute(route);
          return {
            headerShown: false,
            ...(focusedRoute === "GroupChat" ? { tabBarStyle: { display: "none" as const } } : {}),
          };
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Tapping a tab that's already showing a deeper screen should
            // always land back on that stack's starting screen, not resume
            // wherever navigation was last left.
            e.preventDefault();
            navigation.navigate("Groups", { screen: "GroupsHome" });
          },
        })}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksStack}
        options={{ headerShown: false }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Home's "Tasks done" tile can leave this tab's stack sitting on
            // the completed-tasks view (or, on its very first visit this
            // session, seed the stack with only that screen). The bottom
            // tab icon should always land on the normal Active/Archived
            // tabs view instead of whatever was left there, so force it
            // explicitly.
            e.preventDefault();
            navigation.navigate("Tasks", { screen: "TaskLibrary", params: { mode: undefined } });
          },
        })}
      />
      <Tab.Screen name="Notifications" component={NotificationsStack} options={{ headerShown: false }} />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ headerShown: false, tabBarLabel: "Settings" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate("Profile", { screen: "ProfileHome" });
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
