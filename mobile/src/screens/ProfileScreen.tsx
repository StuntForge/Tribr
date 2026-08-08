import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "../context/AuthContext";
import AnimatedPressable from "../components/AnimatedPressable";
import Avatar from "../components/Avatar";
import ProBadge from "../components/ProBadge";
import Reveal from "../components/Reveal";
import { colors, radii, shadows, spacing, type } from "../theme";

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
      <View style={styles.header}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 140" pointerEvents="none">
          <Circle cx="20" cy="10" r="60" fill={colors.primaryDark} opacity={0.3} />
          <Circle cx="290" cy="120" r="70" fill={colors.accent} opacity={0.22} />
        </Svg>
        <View style={styles.avatarRing}>
          <Avatar name={profile.firstName} photoUrl={profile.profilePhotoUrl} size={92} />
        </View>
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
      </View>

      <Reveal delay={nextDelay()}>
        <Section title="Subscription" icon="star">
          <View style={styles.subscriptionRow}>
            {profile.subscriptionTier === "SUBSCRIBER" ? (
              <ProBadge />
            ) : (
              <View style={styles.subscriptionBadge}>
                <Ionicons name="leaf" size={20} color={colors.primary} />
              </View>
            )}
            <Text style={styles.hint}>
              {profile.subscriptionTier === "SUBSCRIBER"
                ? "You're a Subscriber - up to 20 tasks, 6 groups, and you can create groups."
                : "You're on the Free plan - 1 task, 1 group, and you can't create groups."}
            </Text>
          </View>
          <AnimatedPressable style={styles.primaryOutlineButton} onPress={() => navigation.navigate("Subscription")}>
            <Ionicons name="card" size={16} color={colors.primary} />
            <Text style={styles.primaryOutlineButtonText}>Manage subscription</Text>
          </AnimatedPressable>
        </Section>
      </Reveal>

      <Reveal delay={nextDelay()}>
        <AnimatedPressable style={styles.settingsRow} onPress={() => navigation.navigate("Favourites")}>
          <Ionicons name="heart-outline" size={18} color={colors.text} />
          <Text style={styles.settingsRowText}>Favourites</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AnimatedPressable>

        <AnimatedPressable style={styles.settingsRow} onPress={() => navigation.navigate("BlockedUsers")}>
          <Ionicons name="ban-outline" size={18} color={colors.text} />
          <Text style={styles.settingsRowText}>Blocked users</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AnimatedPressable>

        <AnimatedPressable style={styles.settingsRow} onPress={() => navigation.navigate("AccountSettings")}>
          <Ionicons name="settings-outline" size={18} color={colors.text} />
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

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={14} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    overflow: "hidden",
    ...shadows.raised,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 22, fontWeight: "700", color: "#fff" },
  meta: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: spacing.xs },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  ratingText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  ratingSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  section: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...type.h3 },
  hint: { ...type.caption, marginBottom: spacing.sm, flex: 1 },
  primaryOutlineButton: {
    flexDirection: "row",
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    padding: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryOutlineButtonText: { color: colors.primary, fontWeight: "700" },
  subscriptionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  subscriptionBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
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
