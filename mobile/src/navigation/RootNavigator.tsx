import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import CreateProfileScreen from "../screens/auth/CreateProfileScreen";
import { colors } from "../theme";

export default function RootNavigator() {
  const { loading, isAuthenticated, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? <AuthStack /> : !profile?.profileComplete ? <CreateProfileScreen /> : <MainTabs />}
    </NavigationContainer>
  );
}
