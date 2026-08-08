import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getFavourites } from "../../api/search";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, spacing } from "../../theme";

export default function FavouritesScreen({ navigation }: any) {
  const { data: favourites, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["favourites"], queryFn: getFavourites });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={favourites}
      keyExtractor={(f) => f.userId}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No favourites yet</Text>
          <Text style={styles.emptyBody}>Favourite members you've worked with to invite them back easily next time.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate("Groups", { screen: "PublicProfile", params: { userId: item.userId } })}
        >
          <Avatar name={item.firstName} photoUrl={null} size={36} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.firstName}</Text>
              {item.isPro && <ProBadge size="tiny" />}
            </View>
            <Text style={styles.rating}>{item.overallRating != null ? `★ ${item.overallRating.toFixed(1)}` : "No ratings yet"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  rating: { fontSize: 13, color: colors.star, fontWeight: "600" },
});
