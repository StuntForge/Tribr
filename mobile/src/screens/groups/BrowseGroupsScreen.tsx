import React, { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { browseGroups } from "../../api/groups";
import { getJobCategories } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

export default function BrowseGroupsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isSubscriber = profile?.subscriptionTier === "SUBSCRIBER";
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories, enabled: isSubscriber });
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["browse-groups", categoryId],
    queryFn: () => browseGroups({ categoryId: categoryId ?? undefined }),
  });

  return (
    <View style={styles.container}>
      {isSubscriber && categories && categories.length > 0 && (
        <View style={styles.filters}>
          <View style={styles.chipRow}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, categoryId === c.id && styles.chipSelected]}
                onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
              >
                <Text style={[styles.chipText, categoryId === c.id && styles.chipTextSelected]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No groups recruiting right now</Text>
              <Text style={styles.emptyBody}>Check back soon, or create your own if you're a Subscriber.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.averageMemberRating != null && <Text style={styles.cardRating}>★ {item.averageMemberRating.toFixed(1)}</Text>}
              </View>
              <Text style={styles.cardMeta}>
                {item.category ?? "Any category"} · {item.memberCount}/{item.sizeMax} members · led by {item.leaderName}
                {item.approxDistanceMiles != null ? ` · ${item.approxDistanceMiles} mi away` : ""}
              </Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  filters: { padding: spacing.lg, paddingBottom: 0 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  cardRating: { fontSize: 13, color: colors.star, fontWeight: "600" },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  cardDescription: { fontSize: 13, color: colors.text, marginTop: spacing.xs },
});
