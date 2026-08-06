import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import TaskLibraryScreen from "../screens/tasks/TaskLibraryScreen";
import CreateEditTaskScreen from "../screens/tasks/CreateEditTaskScreen";
import SubscriptionScreen from "../screens/SubscriptionScreen";
import AccountSettingsScreen from "../screens/AccountSettingsScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import ChangePhoneScreen from "../screens/ChangePhoneScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="TaskLibrary" component={TaskLibraryScreen} options={{ title: "My Tasks" }} />
      <Stack.Screen name="CreateEditTask" component={CreateEditTaskScreen} options={{ title: "Task" }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: "Subscription" }} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} options={{ title: "Account Settings" }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit Profile" }} />
      <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} options={{ title: "Change Number" }} />
    </Stack.Navigator>
  );
}
