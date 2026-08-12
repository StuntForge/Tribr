import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { getNearbyRecruitingGroups } from "../api/groups";
import AnimatedPressable from "./AnimatedPressable";
import Avatar from "./Avatar";
import { colors, radii, shadows, spacing, type } from "../theme";

const CARD_WIDTH = 168;
const IMAGE_HEIGHT = 116;

export default function NearbyGroupsCarousel({ onSeeAll, onPressCard }: { onSeeAll: () => void; onPressCard: (groupId: string) => void }) {
  // The backend already excludes anything not RECRUITING (e.g. a group that
  // just got disbanded) - a stale client cache was the only reason a dead
  // Tribe could keep showing up here, so refetch periodically and on focus.
  const { data, refetch } = useQuery({
    queryKey: ["nearby-recruiting-groups"],
    queryFn: getNearbyRecruitingGroups,
    refetchInterval: 20000,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (!data || data.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>What's happening near you</Text>
        <AnimatedPressable onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all</Text>
        </AnimatedPressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing.sm}
      >
        {data.map((item) => {
          const atMinimum = item.memberCount >= item.sizeMin;
          return (
            <AnimatedPressable key={item.groupId} style={styles.card} onPress={() => onPressCard(item.groupId)}>
              <View style={styles.imageWrap}>
                {item.taskPhotoUrl ? (
                  <Image source={{ uri: item.taskPhotoUrl }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]}>
                    <Ionicons name="image" size={28} color={colors.textMuted} />
                  </View>
                )}
                <View style={[styles.memberBadge, { backgroundColor: atMinimum ? colors.primary : colors.accent }]}>
                  <Text style={styles.memberBadgeText}>
                    {item.memberCount}/{item.sizeMax}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.taskName}
                </Text>
                {item.approxDistanceMiles != null && (
                  <View style={styles.distanceRow}>
                    <Ionicons name="location" size={11} color={colors.textMuted} />
                    <Text style={styles.distanceText}>{item.approxDistanceMiles} miles away</Text>
                  </View>
                )}
                {item.members.length > 0 && (
                  <View style={styles.avatarStack}>
                    {item.members.slice(0, 3).map((m, i) => (
                      <View key={i} style={[styles.avatarStackItem, { marginLeft: i === 0 ? 0 : -10 }]}>
                        <Avatar name={m.firstName} photoUrl={m.photoUrl} size={24} />
                      </View>
                    ))}
                    {item.memberCount > 3 && (
                      <View style={[styles.avatarStackItem, styles.avatarOverflow, { marginLeft: -10 }]}>
                        <Text style={styles.avatarOverflowText}>+{item.memberCount - 3}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading: { ...type.h3 },
  seeAll: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  scrollContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  imageWrap: { width: "100%", height: IMAGE_HEIGHT },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  memberBadge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  memberBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardBody: { padding: spacing.sm },
  cardTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  distanceRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  distanceText: { fontSize: 11, color: colors.textMuted },
  avatarStack: { flexDirection: "row", marginTop: spacing.sm },
  avatarStackItem: { borderWidth: 2, borderColor: colors.surface, borderRadius: 14 },
  avatarOverflow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverflowText: { fontSize: 9, fontWeight: "700", color: colors.textMuted },
});
