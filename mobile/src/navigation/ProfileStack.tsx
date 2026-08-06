import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import TaskLibraryScreen from "../screens/tasks/TaskLibraryScreen";
import CreateEditTaskScreen from "../screens/tasks/CreateEditTaskScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="TaskLibrary" component={TaskLibraryScreen} options={{ title: "My Tasks" }} />
      <Stack.Screen name="CreateEditTask" component={CreateEditTaskScreen} options={{ title: "Task" }} />
    </Stack.Navigator>
  );
}
