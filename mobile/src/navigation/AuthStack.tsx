import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PhoneEntryScreen from "../screens/auth/PhoneEntryScreen";
import VerifyCodeScreen from "../screens/auth/VerifyCodeScreen";

export type AuthStackParamList = {
  PhoneEntry: undefined;
  VerifyCode: { phone: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} options={{ headerShown: true, title: "Verify" }} />
    </Stack.Navigator>
  );
}
