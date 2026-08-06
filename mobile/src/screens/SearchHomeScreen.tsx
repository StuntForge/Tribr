import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function SearchHomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isSubscriber = profile?.subscriptionTier === "SUBSCRIBER";

  const goToGroups = (screen: string) => navigation.navigate("Groups", { screen });

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.card} onPress={() => goToGroups("BrowseGroups")}>
        <Text style={styles.cardTitle}>Browse groups</Text>
        <Text style={styles.cardBody}>Find recruiting groups near you, filtered by category, size and more.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, !isSubscriber && styles.cardDisabled]}
        onPress={() => (isSubscriber ? goToGroups("SearchMembers") : undefined)}
      >
        <Text style={styles.cardTitle}>Find members</Text>
        <Text style={styles.cardBody}>
          {isSubscriber
            ? "Search for potential members by skill, tool, category or rating."
            : "Subscriber feature — search for members instead of waiting for applications."}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => goToGroups("MyInvitations")}>
        <Text style={styles.cardTitle}>My invitations</Text>
        <Text style={styles.cardBody}>Groups that have invited you to join.</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => goToGroups("Favourites")}>
        <Text style={styles.cardTitle}>Favourites</Text>
        <Text style={styles.cardBody}>Members you've worked with before and want to invite again.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardDisabled: { opacity: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  cardBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
