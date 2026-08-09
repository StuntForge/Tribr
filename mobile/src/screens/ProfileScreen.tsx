import React from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import AnimatedPressable from "../components/AnimatedPressable";
import Avatar from "../components/Avatar";
import ProBadge from "../components/ProBadge";
import Reveal from "../components/Reveal";
import WaveHeader from "../components/WaveHeader";
import IconCircle from "../components/IconCircle";
import { colors, radii, shadows, spacing, type } from "../theme";

const HEADER_DECORATION = require("../../assets/illustrations/processed/settings-header.png");

export default function ProfileScreen({ navigation }: any) {
  const { profile, signOut } = useAuth();

  if (!profile) return null;

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  let cardIndex = 0;
  const nextDelay = () => cardIndex++ * 60;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <WaveHeader
        contentStyle={styles.headerContent}
        illustration={<Image source={HEADER_DECORATION} style={styles.headerDecoration} resizeMode="cover" />}
      >
        <AnimatedPressable style={styles.avatarWrap} onPress={() => navigation.navigate("EditProfile")}>
          <View style={styles.avatarRing}>
            <Avatar name={profile.firstName} photoUrl={profile.profilePhotoUrl} size={92} />
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color={colors.primary} />
          </View>
        </AnimatedPressable>
        <Text style={styles.name}>{profile.firstName}</Text>
        <Text style={styles.meta}>
          {profile.age} · {profile.gender} · {profile.locationLabel}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={15} color={colors.star} />
          <Text style={styles.ratingText}>
            {profile.overallRating != null ? profile.overallRating.toFixed(1) : "No ratings yet"}
          </Text>
          <Text style={styles.ratingSub}>· {profile.completedCycles} cycles completed</Text>
        </View>
      </WaveHeader>

      <Reveal delay={nextDelay()}>
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeaderRow}>
            <IconCircle icon="star" size={40} bg={colors.primary} />
            <View style={{ flex: 1 }}>
              <View style={styles.subscriptionTitleRow}>
                <Text style={styles.sectionTitle}>Subscription</Text>
                {profile.subscriptionTier === "SUBSCRIBER" && <ProBadge />}
              </View>
              <Text style={styles.hint}>
                {profile.subscriptionTier === "SUBSCRIBER"
                  ? "You're a Subscriber - up to 20 tasks, 6 Tribes, and you can form Tribes."
                  : "You're on the Free plan - 1 task, 1 Tribe, and you can't form Tribes."}
              </Text>
            </View>
          </View>
          <AnimatedPressable style={styles.primaryOutlineButton} onPress={() => navigation.navigate("Subscription")}>
            <Ionicons name="ribbon" size={16} color={colors.primary} />
            <Text style={styles.primaryOutlineButtonText}>Manage subscription</Text>
          </AnimatedPressable>
        </View>
      </Reveal>

      <Reveal delay={nextDelay()}>
        <AnimatedPressable style={styles.settingsRow} onPress={() => navigation.navigate("Favourites")}>
          <IconCircle icon="heart" size={36} bg={colors.surfaceAlt} color={colors.primary} iconSize={17} />
          <Text style={styles.settingsRowText}>Favourites</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AnimatedPressable>

        <AnimatedPressable style={styles.settingsRow} onPress={() => navigation.navigate("BlockedUsers")}>
          <IconCircle icon="ban" size={36} bg={colors.surfaceAlt} color={colors.primary} iconSize={17} />
          <Text style={styles.settingsRowText}>Blocked users</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AnimatedPressable>

        <AnimatedPressable style={styles.settingsRow} onPress={() => navigation.navigate("AccountSettings")}>
          <IconCircle icon="settings" size={36} bg={colors.surfaceAlt} color={colors.primary} iconSize={17} />
          <Text style={styles.settingsRowText}>Account settings</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AnimatedPressable>

        <AnimatedPressable style={styles.signOutButton} onPress={confirmSignOut}>
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </AnimatedPressable>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  headerDecoration: { width: 100, height: 114, opacity: 0.4, borderRadius: radii.lg },
  headerContent: { alignItems: "center" },
  avatarWrap: { marginBottom: spacing.sm },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  name: { fontSize: 22, fontWeight: "700", color: "#fff" },
  meta: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: spacing.xs },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  ratingText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  ratingSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  subscriptionCard: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  subscriptionHeaderRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  subscriptionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  sectionTitle: { ...type.h3 },
  hint: { ...type.caption, lineHeight: 17 },
  primaryOutlineButton: {
    flexDirection: "row",
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    padding: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  primaryOutlineButtonText: { color: colors.primary, fontWeight: "700" },
  settingsRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.card,
  },
  settingsRowText: { ...type.bodyMedium, flex: 1 },
  signOutButton: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
