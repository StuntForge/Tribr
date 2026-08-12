import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCommittedMembers, recordSocialAttendance, SocialAttendanceEntry, SocialAttendanceStatus } from "../../api/socialSchedule";
import { colors, spacing } from "../../theme";

// Mirrors CompleteTaskScreen.tsx's attendance-recording UI, but with no
// per-attendee star scoring - Social attendance has no worker/host rating,
// only the three-outcome status that feeds Social Reliability.
export default function SocialAttendanceScreen({ route, navigation }: any) {
  const { groupId, groupName } = route.params as { groupId: string; groupName: string };
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: members, isLoading, isError, refetch } = useQuery({
    queryKey: ["social-committed-members", groupId],
    queryFn: () => getCommittedMembers(groupId),
  });

  // Reusing an already-mounted instance of this screen (e.g. tapping back
  // into it, or a notification deep-link) can otherwise show whatever was
  // cached from before who's committed changed.
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const [statuses, setStatuses] = useState<Record<string, SocialAttendanceStatus>>({});
  const getStatus = (userId: string): SocialAttendanceStatus => statuses[userId] ?? "ATTENDED";
  const setStatus = (userId: string, status: SocialAttendanceStatus) => setStatuses((prev) => ({ ...prev, [userId]: status }));

  const mutation = useMutation({
    mutationFn: (attendance: SocialAttendanceEntry[]) => recordSocialAttendance(groupId, attendance),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      Alert.alert("Attendance recorded", `${groupName} is complete.`, [
        { text: "OK", onPress: () => navigation.navigate("GroupDetail", { groupId }) },
      ]);
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Couldn't load who's committed to this Tribe's event.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onSubmit = () => {
    if (!members) return;
    const attendance: SocialAttendanceEntry[] = members.map((m) => ({ userId: m.userId, status: getStatus(m.userId) }));
    mutation.mutate(attendance);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Record attendance</Text>
      <Text style={styles.subtitle}>Who made it to {groupName}?</Text>

      {members?.length === 0 && <Text style={styles.hint}>Nobody was committed to this Tribe's event.</Text>}

      {members?.map((m) => {
        const status = getStatus(m.userId);
        return (
          <View key={m.userId} style={styles.card}>
            <Text style={styles.name}>{m.firstName}</Text>
            <View style={styles.chipRow}>
              {(["ATTENDED", "NO_SHOW", "VALID_REASON"] as SocialAttendanceStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, status === s && styles.chipSelected]}
                  onPress={() => setStatus(m.userId, s)}
                >
                  <Text style={[styles.chipText, status === s && styles.chipTextSelected]}>
                    {s === "ATTENDED" ? "Attended" : s === "NO_SHOW" ? "No show" : "Valid reason"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={mutation.isPending || !members?.length}>
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Record attendance</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  hint: { fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  name: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  error: { color: colors.danger, marginBottom: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  retryButton: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryButtonText: { color: "#fff", fontWeight: "600" },
});
