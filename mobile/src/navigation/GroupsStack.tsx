import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GroupsHomeScreen from "../screens/groups/GroupsHomeScreen";
import BrowseGroupsScreen from "../screens/groups/BrowseGroupsScreen";
import CreateGroupScreen from "../screens/groups/CreateGroupScreen";
import GroupDetailScreen from "../screens/groups/GroupDetailScreen";
import ApplicationsScreen from "../screens/groups/ApplicationsScreen";
import GroupChatScreen from "../screens/groups/GroupChatScreen";
import TaskScheduleScreen from "../screens/groups/TaskScheduleScreen";
import CompleteTaskScreen from "../screens/groups/CompleteTaskScreen";
import RateHostScreen from "../screens/groups/RateHostScreen";

const Stack = createNativeStackNavigator();

export default function GroupsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="GroupsHome" component={GroupsHomeScreen} options={{ title: "Groups" }} />
      <Stack.Screen name="BrowseGroups" component={BrowseGroupsScreen} options={{ title: "Browse Groups" }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: "Create Group" }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: "Group" }} />
      <Stack.Screen name="Applications" component={ApplicationsScreen} options={{ title: "Applications" }} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} options={{ title: "Group Chat" }} />
      <Stack.Screen name="TaskSchedule" component={TaskScheduleScreen} options={{ title: "Schedule" }} />
      <Stack.Screen name="CompleteTask" component={CompleteTaskScreen} options={{ title: "Complete Task" }} />
      <Stack.Screen name="RateHost" component={RateHostScreen} options={{ title: "Rate the Host" }} />
    </Stack.Navigator>
  );
}
