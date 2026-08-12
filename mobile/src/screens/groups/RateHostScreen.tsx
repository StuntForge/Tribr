import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGroup, rateHost } from "../../api/groups";
import { categoryThumbnail } from "../../constants/categoryThumbnails";
import { colors, radii, spacing, type } from "../../theme";

export default function RateHostScreen({ route, navigation }: any) {
  const { groupId, taskId, taskName } = route.params as { groupId: string; taskId: string; taskName?: string };
  const queryClient = useQueryClient();
  const [hosting, setHosting] = useState(3);
  const [accuracy, setAccuracy] = useState(3);
  const [attitude, setAttitude] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const { data: group } = useQuery({ queryKey: ["group", groupId], queryFn: () => getGroup(groupId) });
  const host = group?.members.find((m) => m.currentTask?.id === taskId);

  const mutation = useMutation({
    mutationFn: () => rateHost(groupId, taskId, hosting, accuracy, attitude),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      Alert.alert("Thanks!", "Your rating has been submitted.", [{ text: "OK", onPress: () => navigation.navigate("GroupDetail", { groupId }) }]);
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const thumb = host?.currentTask?.photoUrl ? { uri: host.currentTask.photoUrl } : categoryThumbnail(host?.currentTask?.category);
  const displayTaskName = taskName ?? host?.currentTask?.name ?? "this task";

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        {thumb ? <Image source={thumb} style={styles.headerThumb} resizeMode="cover" /> : <View style={styles.headerThumbPlaceholder} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Rate {host?.firstName ?? "the host"}</Text>
          <Text style={styles.headerSubtitle}>
            {displayTaskName}
            {group ? ` · ${group.name}` : ""}
          </Text>
        </View>
      </View>

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
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  headerThumb: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  headerThumbPlaceholder: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  headerTitle: { ...type.h3 },
  headerSubtitle: { ...type.caption, marginTop: 2 },
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
