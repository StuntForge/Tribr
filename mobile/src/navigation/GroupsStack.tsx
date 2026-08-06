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
import SearchMembersScreen from "../screens/groups/SearchMembersScreen";
import PublicProfileScreen from "../screens/groups/PublicProfileScreen";
import InviteToGroupScreen from "../screens/groups/InviteToGroupScreen";
import MyInvitationsScreen from "../screens/groups/MyInvitationsScreen";
import FavouritesScreen from "../screens/groups/FavouritesScreen";

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
      <Stack.Screen name="SearchMembers" component={SearchMembersScreen} options={{ title: "Find Members" }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="InviteToGroup" component={InviteToGroupScreen} options={{ title: "Invite" }} />
      <Stack.Screen name="MyInvitations" component={MyInvitationsScreen} options={{ title: "My Invitations" }} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} options={{ title: "Favourites" }} />
    </Stack.Navigator>
  );
}
