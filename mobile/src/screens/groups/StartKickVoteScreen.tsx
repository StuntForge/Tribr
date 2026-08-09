import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startKickVote } from "../../api/groups";
import { colors, spacing } from "../../theme";

export default function StartKickVoteScreen({ route, navigation }: any) {
  const { groupId, targetUserId, targetName } = route.params as { groupId: string; targetUserId: string; targetName: string };
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => startKickVote(groupId, targetUserId, reason.trim()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["group-kick-votes", groupId] });
      navigation.replace("KickVote", { voteId: result.id });
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
      <Text style={styles.title}>Start a vote to remove {targetName}</Text>
      <Text style={styles.hint}>
        Everyone else currently in the Tribe will need to agree before {targetName} is removed. If even one person
        disagrees, the vote fails.
      </Text>

      <Text style={styles.label}>Why?</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={reason}
        onChangeText={setReason}
        placeholder="Give a brief, honest reason the rest of the Tribe can see."
        multiline
        numberOfLines={4}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !reason.trim() && styles.buttonDisabled]}
        onPress={() => mutation.mutate()}
        disabled={!reason.trim() || mutation.isPending}
      >
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start vote</Text>}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  error: { color: colors.danger, marginTop: spacing.md },
  button: { backgroundColor: colors.danger, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
