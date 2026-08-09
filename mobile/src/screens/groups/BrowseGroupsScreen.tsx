import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { browseGroups } from "../../api/groups";
import { getJobCategories } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import AnimatedPressable from "../../components/AnimatedPressable";
import LocationMap from "../../components/LocationMap";
import ProBadge from "../../components/ProBadge";
import SortSelect from "../../components/SortSelect";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import SegmentedTabs from "../../components/SegmentedTabs";
import { colors, radii, shadows, spacing } from "../../theme";

type SortKey = "distance" | "members";

const RADIUS_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "5 mi", value: 5 },
  { label: "10 mi", value: 10 },
  { label: "25 mi", value: 25 },
  { label: "50 mi", value: 50 },
];

const SIZE_OPTIONS: { label: string; sizeMin?: number; sizeMax?: number }[] = [
  { label: "Any" },
  { label: "2-3", sizeMin: 2, sizeMax: 3 },
  { label: "4-5", sizeMin: 4, sizeMax: 5 },
  { label: "6+", sizeMin: 6 },
];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Gardening: "leaf",
  "Moving & Lifting": "cube",
  "DIY & General": "hammer",
  Decorating: "color-palette",
};

function iconForCategory(name: string | null) {
  return (name && CATEGORY_ICONS[name]) || "people";
}

type FilterKey = "radius" | "size" | "category";

export default function BrowseGroupsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isSubscriber = profile?.subscriptionTier === "SUBSCRIBER";
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [view, setView] = useState<"list" | "map">("list");
  const [expandedFilter, setExpandedFilter] = useState<FilterKey | null>(null);
  const [sort, setSort] = useState<SortKey>("distance");
  const [stripCollapsed, setStripCollapsed] = useState(false);

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories, enabled: isSubscriber });
  const sizeOption = SIZE_OPTIONS[sizeIndex];
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["browse-groups", categoryId, radius, sizeIndex],
    queryFn: () =>
      browseGroups({
        categoryId: categoryId ?? undefined,
        maxDistanceMiles: radius ?? undefined,
        sizeMin: sizeOption.sizeMin,
        sizeMax: sizeOption.sizeMax,
      }),
  });

  const sortedGroups = useMemo(() => {
    if (!groups) return groups;
    const copy = [...groups];
    if (sort === "distance") {
      copy.sort((a, b) => (a.approxDistanceMiles ?? Infinity) - (b.approxDistanceMiles ?? Infinity));
    } else {
      copy.sort((a, b) => b.memberCount - a.memberCount);
    }
    return copy;
  }, [groups, sort]);

  const toggleFilter = (key: FilterKey) => setExpandedFilter((v) => (v === key ? null : key));
  const radiusLabel = RADIUS_OPTIONS.find((o) => o.value === radius)?.label ?? "Any";

  return (
    <View style={styles.container}>
      <WaveHeader style={styles.header}>
        <View style={styles.topRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </AnimatedPressable>
          <TribrLogo />
        </View>
        <Text style={styles.title}>Find a Tribe</Text>
        <Text style={styles.subtitle}>Find local Tribes and start getting things done together.</Text>
      </WaveHeader>
      <View style={styles.filters}>
        <View style={styles.filterBar}>
          <FilterPill label="Radius" value={radiusLabel} active={expandedFilter === "radius"} onPress={() => toggleFilter("radius")} />
          <FilterPill label="Size" value={SIZE_OPTIONS[sizeIndex].label} active={expandedFilter === "size"} onPress={() => toggleFilter("size")} />
          {isSubscriber && (
            <FilterPill label="Category" value={categoryName ?? "Any"} active={expandedFilter === "category"} onPress={() => toggleFilter("category")} />
          )}
          <SortSelect
            options={[
              { value: "distance", label: "Distance" },
              { value: "members", label: "Total members" },
            ]}
            value={sort}
            onChange={setSort}
          />
        </View>

        {expandedFilter === "radius" && (
          <View style={styles.expandedPanel}>
            <View style={styles.chipWrap}>
              {RADIUS_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.label}
                  label={opt.label}
                  selected={radius === opt.value}
                  onPress={() => {
                    setRadius(opt.value);
                    setExpandedFilter(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {expandedFilter === "size" && (
          <View style={styles.expandedPanel}>
            <View style={styles.chipWrap}>
              {SIZE_OPTIONS.map((opt, i) => (
                <FilterChip
                  key={opt.label}
                  label={opt.label}
                  selected={sizeIndex === i}
                  onPress={() => {
                    setSizeIndex(i);
                    setExpandedFilter(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {expandedFilter === "category" && isSubscriber && categories && (
          <View style={styles.expandedPanel}>
            <View style={styles.chipWrap}>
              <FilterChip
                label="Any"
                selected={categoryId === null}
                onPress={() => {
                  setCategoryId(null);
                  setCategoryName(null);
                  setExpandedFilter(null);
                }}
              />
              {categories.map((c) => (
                <FilterChip
                  key={c.id}
                  label={c.name}
                  selected={categoryId === c.id}
                  onPress={() => {
                    setCategoryId(c.id);
                    setCategoryName(c.name);
                    setExpandedFilter(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        <SegmentedTabs
          options={[
            { value: "list", label: "List", icon: "list" },
            { value: "map", label: "Map", icon: "map" },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : view === "map" ? (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <LocationMap
              markers={(groups ?? [])
                .filter((g) => g.locationLat != null && g.locationLng != null)
                .map((g) => ({
                  id: g.id,
                  lat: g.locationLat!,
                  lng: g.locationLng!,
                  label: g.leaderName ?? "Unknown",
                  title: g.name,
                  snippet: `${g.memberCount}/${g.sizeMax} members${g.approxDistanceMiles != null ? ` · ${g.approxDistanceMiles} mi` : ""}`,
                }))}
              center={
                profile?.locationLat != null && profile?.locationLng != null
                  ? { lat: profile.locationLat, lng: profile.locationLng }
                  : { lat: 53.1699, lng: -0.1699 }
              }
              onSelectMarker={(groupId) => navigation.navigate("GroupDetail", { groupId })}
            />
          </View>
          {(sortedGroups?.length ?? 0) > 0 && (
            <View style={styles.stripWrap}>
              <AnimatedPressable style={styles.stripHandle} onPress={() => setStripCollapsed((v) => !v)}>
                <Ionicons name={stripCollapsed ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
              </AnimatedPressable>
              {!stripCollapsed && (
                <FlatList
                  data={sortedGroups}
                  keyExtractor={(g) => g.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.stripContent}
                  renderItem={({ item }) => (
                    <AnimatedPressable style={styles.stripCard} onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}>
                      <View style={styles.stripCardIcon}>
                        <Ionicons name={iconForCategory(item.categories[0] ?? null)} size={20} color="#fff" />
                        <View style={[styles.stripCardBadge, !item.eligibleToApply && styles.stripCardBadgeMuted]}>
                          <Text style={styles.stripCardBadgeText}>
                            {item.memberCount}/{item.sizeMax}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.stripCardTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.stripCardMetaRow}>
                        <Ionicons name="location" size={11} color={colors.textMuted} />
                        <Text style={styles.stripCardMeta}>
                          {item.approxDistanceMiles != null ? `${item.approxDistanceMiles} miles away` : "Distance unknown"}
                        </Text>
                      </View>
                    </AnimatedPressable>
                  )}
                />
              )}
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={sortedGroups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No Tribes match your search</Text>
              <Text style={styles.emptyBody}>Try widening your radius or clearing a filter.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AnimatedPressable
              style={[styles.card, !item.eligibleToApply && styles.cardIneligible]}
              onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={iconForCategory(item.categories[0] ?? null)} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.averageMemberRating != null && (
                    <View style={styles.ratingPill}>
                      <Ionicons name="star" size={12} color={colors.star} />
                      <Text style={styles.cardRating}>{item.averageMemberRating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.categoryBadgeRow}>
                  {item.categories.length > 0 ? (
                    item.categories.map((c) => (
                      <View key={c} style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{c}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>Any category</Text>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.cardMeta}>
                    {item.memberCount}/{item.sizeMax} members · led by {item.leaderName}
                    {item.approxDistanceMiles != null ? ` · ${item.approxDistanceMiles} mi away` : ""}
                  </Text>
                  {item.leaderIsPro && <ProBadge size="tiny" />}
                </View>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                {(item.verifiedOnly || item.minRating != null) && (
                  <View style={styles.requirementRow}>
                    <Ionicons name="shield-checkmark" size={12} color={item.eligibleToApply ? colors.primary : colors.danger} />
                    <Text style={[styles.requirementText, !item.eligibleToApply && styles.requirementTextBlocked]}>
                      {item.verifiedOnly ? "Verified members only" : ""}
                      {item.verifiedOnly && item.minRating != null ? " · " : ""}
                      {item.minRating != null ? `${item.minRating.toFixed(1)}★ minimum` : ""}
                      {!item.eligibleToApply ? " (you don't qualify yet)" : ""}
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedPressable>
          )}
        />
      )}
    </View>
  );
}

function FilterPill({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable style={[styles.filterPill, active && styles.filterPillActive]} onPress={onPress}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
        {label}: {value}
      </Text>
      <Ionicons name={active ? "chevron-up" : "chevron-down"} size={13} color={active ? "#fff" : colors.textMuted} />
    </AnimatedPressable>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { marginBottom: 0 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  filters: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  filterBar: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  filterPillTextActive: { color: "#fff" },
  expandedPanel: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  stripWrap: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadows.raised,
  },
  stripHandle: { alignItems: "center", paddingVertical: 6 },
  stripContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  stripCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    ...shadows.card,
  },
  stripCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  stripCardBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  stripCardBadgeMuted: { backgroundColor: colors.accent },
  stripCardBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  stripCardTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  stripCardMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  stripCardMeta: { fontSize: 11, color: colors.textMuted },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardRating: { fontSize: 13, color: colors.star, fontWeight: "600" },
  categoryBadgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs, marginTop: 4 },
  categoryBadge: { backgroundColor: colors.primaryLight, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  cardDescription: { fontSize: 13, color: colors.text, marginTop: spacing.xs },
  cardIneligible: { opacity: 0.7 },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  requirementText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  requirementTextBlocked: { color: colors.danger },
});
