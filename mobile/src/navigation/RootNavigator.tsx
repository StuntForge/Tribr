import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useTutorialSeen } from "../hooks/useTutorialSeen";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import CreateProfileScreen from "../screens/auth/CreateProfileScreen";
import TutorialPager from "../components/TutorialPager";
import { colors } from "../theme";

export default function RootNavigator() {
  const { loading, isAuthenticated, profile } = useAuth();
  const { loading: tutorialLoading, seen: tutorialSeen, markSeen } = useTutorialSeen();

  const readyToGateTutorial = isAuthenticated && profile?.profileComplete;

  if (loading || (readyToGateTutorial && tutorialLoading)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : !profile?.profileComplete ? (
        <CreateProfileScreen />
      ) : !tutorialSeen ? (
        <TutorialPager onFinish={markSeen} />
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}
