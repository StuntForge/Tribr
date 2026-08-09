import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getFavourites } from "../../api/search";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import WaveHeader from "../../components/WaveHeader";
import AnimatedPressable from "../../components/AnimatedPressable";
import EmptyState from "../../components/EmptyState";
import { InfoCard, InfoCardRow } from "../../components/InfoCard";
import { colors, radii, spacing } from "../../theme";

const EMPTY_IMAGE = require("../../../assets/illustrations/processed/favourites-empty-state.png");

export default function FavouritesScreen({ navigation }: any) {
  const { data: favourites, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["favourites"], queryFn: getFavourites });

  const Header = (
    <WaveHeader illustration={<View style={styles.headerIllustration}><Ionicons name="heart" size={26} color="rgba(255,255,255,0.85)" /></View>}>
      <View style={styles.topRow}>
        <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </AnimatedPressable>
      </View>
      <Text style={styles.title}>Favourites</Text>
      <Text style={styles.subtitle}>Your favourite members</Text>
    </WaveHeader>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Header}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={favourites}
        keyExtractor={(f) => f.userId}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState icon="heart" badgeIcon="person" image={EMPTY_IMAGE} imageAspectRatio={1048 / 875} title="No favourites yet" body="Favourite members you've worked with to invite them back easily next time.">
            <View style={styles.infoCardWrap}>
              <InfoCard>
                <InfoCardRow icon="people" title="Why favourite members?" body="Favourite people you've had great experiences with. They'll appear at the top when inviting to Tribes." />
                <InfoCardRow icon="bulb" body="Tip: You can favourite members from their profile." divider />
              </InfoCard>
            </View>
            <TouchableOpacity
              style={styles.findButton}
              onPress={() => navigation.navigate("Groups", { screen: "SearchMembers" })}
            >
              <Ionicons name="person-add" size={16} color="#fff" />
              <Text style={styles.findButtonText}>Find members to invite</Text>
            </TouchableOpacity>
          </EmptyState>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  headerIllustration: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    margin: 18,
  },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  infoCardWrap: { alignSelf: "stretch", marginTop: spacing.md },
  findButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  findButtonText: { color: "#fff", fontWeight: "700" },
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
