import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TaskLibraryScreen from "../screens/tasks/TaskLibraryScreen";
import CreateEditTaskScreen from "../screens/tasks/CreateEditTaskScreen";
import TaskDetailScreen from "../screens/tasks/TaskDetailScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

export default function TasksStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="TaskLibrary" component={TaskLibraryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateEditTask" component={CreateEditTaskScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: "Task" }} />
    </Stack.Navigator>
  );
}
