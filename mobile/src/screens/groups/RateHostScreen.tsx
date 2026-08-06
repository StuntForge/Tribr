import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rateHost } from "../../api/groups";
import { colors, spacing } from "../../theme";

export default function RateHostScreen({ route, navigation }: any) {
  const { groupId, taskId, taskName } = route.params as { groupId: string; taskId: string; taskName?: string };
  const queryClient = useQueryClient();
  const [hosting, setHosting] = useState(3);
  const [accuracy, setAccuracy] = useState(3);
  const [attitude, setAttitude] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => rateHost(groupId, taskId, hosting, accuracy, attitude),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      Alert.alert("Thanks!", "Your rating stays hidden until the cycle ends.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rate the host</Text>
      <Text style={styles.subtitle}>
        {taskName ? `How was "${taskName}"?` : "How was this task?"} This stays hidden until the cycle ends.
      </Text>

      <ScoreRow label="Hosting (preparation & organisation)" value={hosting} onChange={setHosting} />
      <ScoreRow label="Accuracy (matched what was described)" value={accuracy} onChange={setAccuracy} />
      <ScoreRow label="Attitude" value={attitude} onChange={setAttitude} />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit rating</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ScoreRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreButtons}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} style={[styles.scoreButton, value === n && styles.scoreButtonSelected]} onPress={() => onChange(n)}>
            <Text style={[styles.scoreButtonText, value === n && styles.scoreButtonTextSelected]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  scoreRow: { marginBottom: spacing.lg },
  scoreLabel: { fontSize: 13, color: colors.text, marginBottom: spacing.sm, fontWeight: "600" },
  scoreButtons: { flexDirection: "row", gap: spacing.sm },
  scoreButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scoreButtonSelected: { backgroundColor: colors.star, borderColor: colors.star },
  scoreButtonText: { color: colors.text, fontSize: 15 },
  scoreButtonTextSelected: { color: "#fff", fontWeight: "700" },
  error: { color: colors.danger, marginBottom: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
