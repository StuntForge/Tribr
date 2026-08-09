import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getGroupHistory, GroupHistoryEntry } from "../../api/groups";
import AnimatedPressable from "../../components/AnimatedPressable";
import { colors, radii, shadows, spacing } from "../../theme";

type Tab = "COMPLETED" | "DISBANDED";

export default function GroupHistoryScreen({ navigation }: any) {
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["group-history"], queryFn: getGroupHistory });
  const [tab, setTab] = useState<Tab>("COMPLETED");

  const filtered = useMemo(() => groups?.filter((g) => g.state === tab) ?? [], [groups, tab]);
  const completedCount = groups?.filter((g) => g.state === "COMPLETED").length ?? 0;
  const disbandedCount = groups?.filter((g) => g.state === "DISBANDED").length ?? 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TabButton label="Completed" count={completedCount} active={tab === "COMPLETED"} onPress={() => setTab("COMPLETED")} />
        <TabButton label="Disbanded" count={disbandedCount} active={tab === "DISBANDED"} onPress={() => setTab("DISBANDED")} />
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(g) => g.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tab === "COMPLETED" ? "No completed Tribes yet" : "No disbanded Tribes"}</Text>
            <Text style={styles.emptyBody}>
              {tab === "COMPLETED"
                ? "Tribes that finish a full cycle will show up here."
                : "Tribes that were disbanded will show up here."}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: GroupHistoryEntry }) => (
          <AnimatedPressable
            style={styles.card}
            onPress={() => navigation.navigate("GroupHistoryMembers", { groupId: item.id, groupName: item.name })}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.name}</Text>
                {item.isLeader && <Ionicons name="star" size={12} color={colors.star} />}
              </View>
              <Text style={styles.meta}>
                {item.memberCount} member{item.memberCount === 1 ? "" : "s"}
                {item.myStatus === "LEFT" ? " · You left" : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </AnimatedPressable>
        )}
      />
    </View>
  );
}

function TabButton({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  tabRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  tabButtonTextActive: { color: "#fff" },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
