import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import SubscriptionScreen from "../screens/SubscriptionScreen";
import AccountSettingsScreen from "../screens/AccountSettingsScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import FavouritesScreen from "../screens/groups/FavouritesScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: "Subscription" }} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} options={{ title: "Account Settings" }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
