import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchHomeScreen from "../screens/SearchHomeScreen";

const Stack = createNativeStackNavigator();

export default function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SearchHome" component={SearchHomeScreen} options={{ title: "Search" }} />
    </Stack.Navigator>
  );
}
