import React, { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getJobCategories } from "../../api/tasks";
import { MemberSearchResult, searchMembers } from "../../api/search";
import { colors, spacing } from "../../theme";

export default function SearchMembersScreen({ route, navigation }: any) {
  const { groupIdToInviteTo } = (route.params ?? {}) as { groupIdToInviteTo?: string };
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories });
  const { data: results, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["member-search", query, categoryId],
    queryFn: () => searchMembers({ query: query || undefined, categoryId: categoryId ?? undefined }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, skill or tool"
          onSubmitEditing={() => refetch()}
        />
        <View style={styles.chipRow}>
          {categories?.map((c) => (
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

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<Text style={styles.emptyBody}>No members found.</Text>}
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              onPress={() =>
                navigation.navigate("PublicProfile", { userId: item.id, groupIdToInviteTo, activeTasks: item.activeTasks })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function MemberCard({ member, onPress }: { member: MemberSearchResult; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{member.firstName}</Text>
        <Text style={styles.cardRating}>{member.overallRating != null ? `★ ${member.overallRating.toFixed(1)}` : "No ratings yet"}</Text>
      </View>
      {member.approxDistanceMiles != null && <Text style={styles.cardMeta}>{member.approxDistanceMiles} mi away</Text>}
      {member.skills.length > 0 && <Text style={styles.cardMeta}>Skills: {member.skills.join(", ")}</Text>}
      {member.activeTasks.length > 0 && <Text style={styles.cardMeta}>Task: {member.activeTasks.map((t) => t.name).join(", ")}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { padding: spacing.lg, paddingBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardName: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardRating: { fontSize: 13, color: colors.star, fontWeight: "600" },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
