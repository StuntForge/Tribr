import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { castKickBallot, getKickVote } from "../../api/groups";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, shadows, spacing } from "../../theme";

export default function KickVoteScreen({ route }: any) {
  const { voteId } = route.params as { voteId: string };
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: vote, isLoading } = useQuery({ queryKey: ["kick-vote", voteId], queryFn: () => getKickVote(voteId) });

  const ballotMutation = useMutation({
    mutationFn: (choice: "YES" | "NO") => castKickBallot(voteId, choice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kick-vote", voteId] });
      queryClient.invalidateQueries({ queryKey: ["group-kick-votes"] });
      queryClient.invalidateQueries({ queryKey: ["group"] });
    },
  });

  if (isLoading || !vote) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const myBallot = vote.ballots.find((b) => b.voterId === profile?.id);
  const isTarget = vote.target.id === profile?.id;
  const yesCount = vote.ballots.filter((b) => b.choice === "YES").length;
  const canVote = vote.outcome == null && !isTarget && !myBallot;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Remove {vote.target.firstName}?</Text>
        <Text style={styles.meta}>Started by {vote.initiator.firstName}</Text>
        <Text style={styles.reasonLabel}>Reason given</Text>
        <Text style={styles.reason}>"{vote.reason}"</Text>

        <View style={styles.tallyRow}>
          <Ionicons name="people" size={16} color={colors.primary} />
          <Text style={styles.tallyText}>
            {yesCount} of {vote.requiredVotes} needed to agree
          </Text>
        </View>

        {vote.outcome && (
          <View style={[styles.outcomeBadge, vote.outcome === "REMOVED" ? styles.outcomeRemoved : styles.outcomeFailed]}>
            <Text style={styles.outcomeText}>{vote.outcome === "REMOVED" ? "Vote passed - member removed" : "Vote failed"}</Text>
          </View>
        )}

        {isTarget && !vote.outcome && <Text style={styles.hint}>This vote is about you - you can't vote on it.</Text>}
        {myBallot && !vote.outcome && (
          <Text style={styles.hint}>You voted {myBallot.choice === "YES" ? "to remove" : "to keep"} {vote.target.firstName}.</Text>
        )}

        {canVote && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.agreeButton}
              onPress={() => ballotMutation.mutate("YES")}
              disabled={ballotMutation.isPending}
            >
              <Text style={styles.agreeButtonText}>Agree, remove them</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keepButton}
              onPress={() => ballotMutation.mutate("NO")}
              disabled={ballotMutation.isPending}
            >
              <Text style={styles.keepButtonText}>Keep them</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Votes so far</Text>
      {vote.ballots.map((b) => (
        <View key={b.voterId} style={styles.ballotRow}>
          <Text style={styles.ballotName}>{b.firstName}</Text>
          <Text style={[styles.ballotChoice, b.choice === "YES" ? styles.ballotYes : styles.ballotNo]}>
            {b.choice === "YES" ? "Agreed to remove" : "Voted to keep"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.card },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  reasonLabel: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: spacing.md },
  reason: { fontSize: 14, color: colors.text, fontStyle: "italic", marginTop: 4, lineHeight: 20 },
  tallyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  tallyText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  outcomeBadge: { borderRadius: radii.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, alignSelf: "flex-start", marginTop: spacing.sm },
  outcomeRemoved: { backgroundColor: colors.danger },
  outcomeFailed: { backgroundColor: colors.textMuted },
  outcomeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  agreeButton: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  agreeButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  keepButton: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  keepButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  ballotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  ballotName: { fontSize: 13, color: colors.text, fontWeight: "600" },
  ballotChoice: { fontSize: 12, fontWeight: "600" },
  ballotYes: { color: colors.danger },
  ballotNo: { color: colors.primary },
});
