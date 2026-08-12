import React from "react";
import { TouchableOpacity } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import GroupsHomeScreen from "../screens/groups/GroupsHomeScreen";
import BrowseGroupsScreen from "../screens/groups/BrowseGroupsScreen";
import CreateGroupScreen from "../screens/groups/CreateGroupScreen";
import GroupDetailScreen from "../screens/groups/GroupDetailScreen";
import CompleteTribeScreen from "../screens/groups/CompleteTribeScreen";
import ApplicationsScreen from "../screens/groups/ApplicationsScreen";
import GroupChatScreen from "../screens/groups/GroupChatScreen";
import TaskScheduleScreen from "../screens/groups/TaskScheduleScreen";
import CompleteTaskScreen from "../screens/groups/CompleteTaskScreen";
import SocialScheduleScreen from "../screens/groups/SocialScheduleScreen";
import SocialAttendanceScreen from "../screens/groups/SocialAttendanceScreen";
import RateHostScreen from "../screens/groups/RateHostScreen";
import SearchMembersScreen from "../screens/groups/SearchMembersScreen";
import PublicProfileScreen from "../screens/groups/PublicProfileScreen";
import GroupHistoryScreen from "../screens/groups/GroupHistoryScreen";
import GroupHistoryMembersScreen from "../screens/groups/GroupHistoryMembersScreen";
import MyInvitationsScreen from "../screens/groups/MyInvitationsScreen";
import GroupCurrentTasksScreen from "../screens/groups/GroupCurrentTasksScreen";
import StartKickVoteScreen from "../screens/groups/StartKickVoteScreen";
import KickVoteScreen from "../screens/groups/KickVoteScreen";
import TaskDetailScreen from "../screens/tasks/TaskDetailScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export default function GroupsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="GroupsHome" component={GroupsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BrowseGroups" component={BrowseGroupsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MyInvitations" component={MyInvitationsScreen} options={{ title: "My Invitations" }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: "Tribe" }} />
      <Stack.Screen name="CompleteTribe" component={CompleteTribeScreen} options={{ title: "Wrap Up" }} />
      <Stack.Screen name="Applications" component={ApplicationsScreen} options={{ title: "Applications" }} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} options={{ title: "Tribe Chat" }} />
      <Stack.Screen name="TaskSchedule" component={TaskScheduleScreen} options={{ title: "Schedule" }} />
      <Stack.Screen name="CompleteTask" component={CompleteTaskScreen} options={{ title: "Complete Task" }} />
      <Stack.Screen name="SocialSchedule" component={SocialScheduleScreen} options={{ title: "Schedule" }} />
      <Stack.Screen name="SocialAttendance" component={SocialAttendanceScreen} options={{ title: "Attendance" }} />
      <Stack.Screen name="RateHost" component={RateHostScreen} options={{ title: "Rate the Host" }} />
      <Stack.Screen name="SearchMembers" component={SearchMembersScreen} options={{ title: "Find Members" }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: "Task" }} />
      <Stack.Screen
        name="GroupCurrentTasks"
        component={GroupCurrentTasksScreen}
        options={({ route }: any) => ({ title: route.params?.groupName ? `${route.params.groupName} - Tasks` : "Current Tasks" })}
      />
      <Stack.Screen name="StartKickVote" component={StartKickVoteScreen} options={{ title: "Vote to Remove" }} />
      <Stack.Screen name="KickVote" component={KickVoteScreen} options={{ title: "Member Vote" }} />
      <Stack.Screen
        name="GroupHistory"
        component={GroupHistoryScreen}
        options={({ navigation }) => ({
          title: "Tribe History",
          // Same fix as CompletedTasks in TasksStack: reached from Home's
          // stat tile, which can be this tab's first navigation this
          // session - the default back button can end up with no history
          // to go back to, so it's forced explicitly here instead.
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate("GroupsHome")} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="GroupHistoryMembers"
        component={GroupHistoryMembersScreen}
        options={({ route }: any) => ({ title: route.params?.groupName ?? "Members" })}
      />
    </Stack.Navigator>
  );
}
