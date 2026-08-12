import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { browseGroups, GroupSummary, TribeType } from "../../api/groups";
import { getJobCategories } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import AnimatedPressable from "../../components/AnimatedPressable";
import LocationMap from "../../components/LocationMap";
import ProBadge from "../../components/ProBadge";
import SortSelect from "../../components/SortSelect";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import SegmentedTabs from "../../components/SegmentedTabs";
import NearbyGroupsCarousel from "../../components/NearbyGroupsCarousel";
import { colors, radii, shadows, spacing } from "../../theme";
import { JOB_LENGTHS, JOB_LENGTH_LABELS, JobLength } from "../../constants/jobLength";
import { categoryThumbnail } from "../../constants/categoryThumbnails";
import { socialCategoryIcon } from "../../constants/socialCategoryIcons";

function formatSocialDate(group: Pick<GroupSummary, "dateType" | "fixedDate" | "fixedStartTime">): string {
  if (group.dateType !== "FIXED" || !group.fixedDate) return "Date: To be arranged";
  const d = new Date(group.fixedDate);
  const dateLabel = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (!group.fixedStartTime) return dateLabel;
  const [h, m] = group.fixedStartTime.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${dateLabel}, ${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

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

type FilterKey = "radius" | "size" | "category" | "jobLength" | "tribeType";
type TribeTypeFilter = TribeType | null;

const TRIBE_TYPE_FILTER_OPTIONS: { label: string; value: TribeTypeFilter }[] = [
  { label: "Any", value: null },
  { label: "Work", value: "WORK" },
  { label: "Social", value: "SOCIAL" },
];

export default function BrowseGroupsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isSubscriber = profile?.subscriptionTier === "SUBSCRIBER";
  const [tribeTypeFilter, setTribeTypeFilter] = useState<TribeTypeFilter>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [jobLength, setJobLength] = useState<JobLength | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [expandedFilter, setExpandedFilter] = useState<FilterKey | null>(null);
  const [sort, setSort] = useState<SortKey>("distance");
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const [selectedMarkerGroupId, setSelectedMarkerGroupId] = useState<string | null>(null);

  // Category vocabulary follows the type filter - Work's multi-purpose task
  // categories vs Social's activity categories are different lists.
  // Switching type invalidates any previously chosen category, below.
  const categoryKind = tribeTypeFilter === "SOCIAL" ? "SOCIAL" : "WORK";
  const { data: categories } = useQuery({
    queryKey: ["job-categories", categoryKind],
    queryFn: () => getJobCategories(categoryKind),
    enabled: isSubscriber,
  });
  const selectTribeTypeFilter = (v: TribeTypeFilter) => {
    setTribeTypeFilter(v);
    setCategoryId(null);
    setCategoryName(null);
  };

  const sizeOption = SIZE_OPTIONS[sizeIndex];
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["browse-groups", categoryId, radius, sizeIndex, jobLength, tribeTypeFilter],
    queryFn: () =>
      browseGroups({
        categoryId: categoryId ?? undefined,
        maxDistanceMiles: radius ?? undefined,
        sizeMin: sizeOption.sizeMin,
        sizeMax: sizeOption.sizeMax,
        jobLength: jobLength ?? undefined,
        tribeType: tribeTypeFilter ?? undefined,
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
          <View style={styles.logoCenter} pointerEvents="none">
            <TribrLogo />
          </View>
        </View>
        <Text style={styles.title}>Find a Tribe</Text>
        <Text style={styles.subtitle}>Find local Tribes and start getting things done together.</Text>
      </WaveHeader>
      <View style={styles.filters}>
        <View style={styles.filterBar}>
          <FilterPill
            label="Type"
            value={TRIBE_TYPE_FILTER_OPTIONS.find((o) => o.value === tribeTypeFilter)?.label ?? "Any"}
            active={expandedFilter === "tribeType"}
            onPress={() => toggleFilter("tribeType")}
          />
          <FilterPill label="Radius" value={radiusLabel} active={expandedFilter === "radius"} onPress={() => toggleFilter("radius")} />
          <FilterPill label="Size" value={SIZE_OPTIONS[sizeIndex].label} active={expandedFilter === "size"} onPress={() => toggleFilter("size")} />
          <FilterPill
            label="Job length"
            value={jobLength ? JOB_LENGTH_LABELS[jobLength] : "Any"}
            active={expandedFilter === "jobLength"}
            onPress={() => toggleFilter("jobLength")}
          />
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

        {expandedFilter === "tribeType" && (
          <View style={styles.expandedPanel}>
            <View style={styles.chipWrap}>
              {TRIBE_TYPE_FILTER_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.label}
                  label={opt.label}
                  selected={tribeTypeFilter === opt.value}
                  onPress={() => {
                    selectTribeTypeFilter(opt.value);
                    setExpandedFilter(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

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

        {expandedFilter === "jobLength" && (
          <View style={styles.expandedPanel}>
            <View style={styles.chipWrap}>
              <FilterChip
                label="Any"
                selected={jobLength === null}
                onPress={() => {
                  setJobLength(null);
                  setExpandedFilter(null);
                }}
              />
              {JOB_LENGTHS.map((l) => (
                <FilterChip
                  key={l}
                  label={JOB_LENGTH_LABELS[l]}
                  selected={jobLength === l}
                  onPress={() => {
                    setJobLength(l);
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
              onSelectMarker={(groupId) => setSelectedMarkerGroupId(groupId)}
            />
            {selectedMarkerGroupId && (
              <MarkerPreviewCard
                group={groups?.find((g) => g.id === selectedMarkerGroupId) ?? null}
                onClose={() => setSelectedMarkerGroupId(null)}
                onView={() => {
                  navigation.navigate("GroupDetail", { groupId: selectedMarkerGroupId });
                  setSelectedMarkerGroupId(null);
                }}
              />
            )}
          </View>
          <View style={styles.stripWrap}>
            <AnimatedPressable
              style={styles.stripHandle}
              onPress={() => setStripCollapsed((v) => !v)}
              accessibilityLabel={stripCollapsed ? "Show nearby Tribes" : "Hide nearby Tribes"}
            >
              <View style={styles.stripHandleBar} />
              <View style={styles.stripHandleButton}>
                <Ionicons name={stripCollapsed ? "chevron-up" : "chevron-down"} size={20} color="#fff" />
              </View>
            </AnimatedPressable>
            {!stripCollapsed && (
              <NearbyGroupsCarousel
                onSeeAll={() => setView("list")}
                onPressCard={(groupId) => navigation.navigate("GroupDetail", { groupId })}
              />
            )}
          </View>
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
              {item.tribeType === "SOCIAL" ? (
                <View style={styles.cardIcon}>
                  <Ionicons name={socialCategoryIcon(item.socialCategory)} size={30} color="#fff" />
                </View>
              ) : categoryThumbnail(item.leaderTaskCategory) ? (
                <Image source={categoryThumbnail(item.leaderTaskCategory)} style={styles.cardPhoto} />
              ) : (
                <View style={styles.cardIcon}>
                  <Ionicons name="people" size={30} color="#fff" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {/* No star rating for Social Tribes (11.13) - only Work results show one. */}
                  {item.tribeType === "WORK" && item.averageMemberRating != null && (
                    <View style={styles.ratingPill}>
                      <Ionicons name="star" size={12} color={colors.star} />
                      <Text style={styles.cardRating}>{item.averageMemberRating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.categoryBadgeRow}>
                  {item.tribeType === "SOCIAL" ? (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.socialCategory ?? "Social"}</Text>
                    </View>
                  ) : item.categories.length > 0 ? (
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
                {item.tribeType === "SOCIAL" && <Text style={styles.socialDateLine}>{formatSocialDate(item)}</Text>}
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

function MarkerPreviewCard({
  group,
  onClose,
  onView,
}: {
  group: GroupSummary | null | undefined;
  onClose: () => void;
  onView: () => void;
}) {
  if (!group) return null;
  const thumbnail = group.tribeType === "WORK" ? categoryThumbnail(group.leaderTaskCategory) : null;
  return (
    <View style={styles.markerCard}>
      {thumbnail ? (
        <Image source={thumbnail} style={styles.markerCardPhoto} />
      ) : (
        <View style={[styles.markerCardPhoto, styles.markerCardPhotoFallback]}>
          <Ionicons name={group.tribeType === "SOCIAL" ? socialCategoryIcon(group.socialCategory) : "people"} size={22} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.markerCardTitle} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.markerCardMeta}>
          {group.memberCount}/{group.sizeMax} members · led by {group.leaderName}
          {group.approxDistanceMiles != null ? ` · ${group.approxDistanceMiles} mi` : ""}
        </Text>
        {group.tribeType === "SOCIAL" && <Text style={styles.markerCardMeta}>{formatSocialDate(group)}</Text>}
        <AnimatedPressable style={styles.markerCardButton} onPress={onView}>
          <Text style={styles.markerCardButtonText}>View Tribe</Text>
        </AnimatedPressable>
      </View>
      <AnimatedPressable onPress={onClose}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </AnimatedPressable>
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
  logoCenter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
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
  markerCard: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    ...shadows.raised,
  },
  markerCardPhoto: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  markerCardPhotoFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  markerCardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  markerCardMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  markerCardButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  markerCardButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stripWrap: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadows.raised,
  },
  stripHandle: { alignItems: "center", paddingVertical: 8, gap: 6 },
  stripHandleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  stripHandleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardPhoto: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
  },
  cardIcon: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
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
  socialDateLine: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },
  cardDescription: { fontSize: 13, color: colors.text, marginTop: spacing.xs },
  cardIneligible: { opacity: 0.7 },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  requirementText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  requirementTextBlocked: { color: colors.danger },
});
