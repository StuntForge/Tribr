import React, { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getJobCategories } from "../../api/tasks";
import { MemberSearchResult, searchMembers } from "../../api/search";
import { useAuth } from "../../context/AuthContext";
import AnimatedPressable from "../../components/AnimatedPressable";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import LocationMap from "../../components/LocationMap";
import { colors, radii, shadows, spacing } from "../../theme";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const RATING_OPTIONS = [null, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export default function SearchMembersScreen({ route, navigation }: any) {
  const { groupIdToInviteTo } = (route.params ?? {}) as { groupIdToInviteTo?: string };
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [maxDistanceMiles, setMaxDistanceMiles] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  const activeFilterCount = [
    ageMin,
    ageMax,
    gender,
    maxDistanceMiles,
    minRating,
    favouritesOnly || null,
    hasPhoto || null,
  ].filter((v) => v != null && v !== "").length;

  const clearFilters = () => {
    setAgeMin("");
    setAgeMax("");
    setGender(null);
    setMaxDistanceMiles("");
    setMinRating(null);
    setFavouritesOnly(false);
    setHasPhoto(false);
  };

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories });
  const { data: results, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["member-search", query, categoryId, ageMin, ageMax, gender, maxDistanceMiles, minRating, favouritesOnly, hasPhoto],
    queryFn: () =>
      searchMembers({
        query: query || undefined,
        categoryId: categoryId ?? undefined,
        ageMin: ageMin ? Number(ageMin) : undefined,
        ageMax: ageMax ? Number(ageMax) : undefined,
        gender: gender ?? undefined,
        maxDistanceMiles: maxDistanceMiles ? Number(maxDistanceMiles) : undefined,
        minRating: minRating ?? undefined,
        favouritesOnly: favouritesOnly || undefined,
        hasPhoto: hasPhoto || undefined,
      }),
  });

  const goToProfile = (item: MemberSearchResult) =>
    navigation.navigate("PublicProfile", { userId: item.id, groupIdToInviteTo });

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name"
          onSubmitEditing={() => refetch()}
        />
        <View style={styles.chipRow}>
          {categories?.map((c) => (
            <AnimatedPressable
              key={c.id}
              style={[styles.chip, categoryId === c.id && styles.chipSelected]}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            >
              <Text style={[styles.chipText, categoryId === c.id && styles.chipTextSelected]}>{c.name}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <AnimatedPressable style={styles.filtersToggle} onPress={() => setFiltersOpen((v) => !v)}>
          <Ionicons name="options" size={16} color={colors.primary} />
          <Text style={styles.filtersToggleText}>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</Text>
          <Ionicons name={filtersOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
        </AnimatedPressable>

        {filtersOpen && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterLabel}>Age</Text>
            <View style={styles.rangeRow}>
              <TextInput
                style={styles.rangeInput}
                value={ageMin}
                onChangeText={setAgeMin}
                placeholder="Min"
                keyboardType="number-pad"
              />
              <Text style={styles.rangeSeparator}>–</Text>
              <TextInput
                style={styles.rangeInput}
                value={ageMax}
                onChangeText={setAgeMax}
                placeholder="Max"
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.filterLabel}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <AnimatedPressable
                  key={g}
                  style={[styles.chip, gender === g && styles.chipSelected]}
                  onPress={() => setGender(gender === g ? null : g)}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>{g}</Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Distance from you</Text>
            <View style={styles.rangeRow}>
              <TextInput
                style={styles.rangeInput}
                value={maxDistanceMiles}
                onChangeText={setMaxDistanceMiles}
                placeholder="Max miles"
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.filterLabel}>Minimum rating</Text>
            <View style={styles.chipRow}>
              {RATING_OPTIONS.map((r) => (
                <AnimatedPressable
                  key={r ?? "any"}
                  style={[styles.chip, minRating === r && styles.chipSelected]}
                  onPress={() => setMinRating(r)}
                >
                  <Text style={[styles.chipText, minRating === r && styles.chipTextSelected]}>
                    {r == null ? "Any" : `${r.toFixed(1)}★`}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <CheckboxRow label="Only show favourites" checked={favouritesOnly} onToggle={() => setFavouritesOnly((v) => !v)} />
            <CheckboxRow label="Only show users with a photo" checked={hasPhoto} onToggle={() => setHasPhoto((v) => !v)} />

            {activeFilterCount > 0 && (
              <AnimatedPressable style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Clear filters</Text>
              </AnimatedPressable>
            )}
          </View>
        )}

        <View style={styles.viewToggle}>
          <AnimatedPressable
            style={[styles.viewToggleButton, view === "list" && styles.viewToggleButtonActive]}
            onPress={() => setView("list")}
          >
            <Ionicons name="list" size={16} color={view === "list" ? "#fff" : colors.text} />
            <Text style={[styles.viewToggleText, view === "list" && styles.viewToggleTextActive]}>List</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.viewToggleButton, view === "map" && styles.viewToggleButtonActive]}
            onPress={() => setView("map")}
          >
            <Ionicons name="map" size={16} color={view === "map" ? "#fff" : colors.text} />
            <Text style={[styles.viewToggleText, view === "map" && styles.viewToggleTextActive]}>Map</Text>
          </AnimatedPressable>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : view === "map" ? (
        <LocationMap
          markers={(results ?? [])
            .filter((m) => m.locationLat != null && m.locationLng != null)
            .map((m) => ({
              id: m.id,
              lat: m.locationLat!,
              lng: m.locationLng!,
              label: m.firstName ?? "Member",
              title: m.firstName ?? "Member",
              snippet: m.overallRating != null ? `★ ${m.overallRating.toFixed(1)}` : "No ratings yet",
            }))}
          center={
            profile?.locationLat != null && profile?.locationLng != null
              ? { lat: profile.locationLat, lng: profile.locationLng }
              : { lat: 53.1699, lng: -0.1699 }
          }
          markerColor={colors.accent}
          onSelectMarker={(userId) => {
            const item = results?.find((r) => r.id === userId);
            if (item) goToProfile(item);
          }}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <Text style={styles.emptyBody}>
              No members found. Only members who've switched on "Looking for a new Tribe" show up here.
            </Text>
          }
          renderItem={({ item }) => <MemberCard member={item} onPress={() => goToProfile(item)} />}
        />
      )}
    </View>
  );
}

function CheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <AnimatedPressable style={styles.checkboxRow} onPress={onToggle}>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={checked ? colors.primary : colors.textMuted} />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

function MemberCard({ member, onPress }: { member: MemberSearchResult; onPress: () => void }) {
  const isSubscriber = member.subscriptionTier === "SUBSCRIBER";
  return (
    <AnimatedPressable style={[styles.card, isSubscriber && styles.cardSubscriber]} onPress={onPress}>
      <View style={isSubscriber ? styles.avatarRingSubscriber : styles.avatarRing}>
        <Avatar name={member.firstName} photoUrl={member.profilePhotoUrl} size={48} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{member.firstName}</Text>
          {isSubscriber && <ProBadge size="tiny" />}
        </View>
        <View style={styles.cardMetaRow}>
          <Ionicons name="star" size={12} color={colors.star} />
          <Text style={styles.cardMeta}>
            {member.overallRating != null ? member.overallRating.toFixed(1) : "No ratings yet"} · {member.completedCycles} cycles
            {member.approxDistanceMiles != null ? ` · ${member.approxDistanceMiles} mi away` : ""}
          </Text>
        </View>
        {member.activeTasks.length > 0 && (
          <Text style={styles.cardTask} numberOfLines={1}>
            Available: {member.activeTasks.map((t) => t.name).join(", ")}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </AnimatedPressable>
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
  filtersToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filtersToggleText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  filterPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  filterLabel: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rangeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 14,
  },
  rangeSeparator: { color: colors.textMuted },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  checkboxLabel: { fontSize: 13, color: colors.text },
  clearButton: { alignSelf: "flex-start", marginTop: spacing.md },
  clearButtonText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 3,
    marginTop: spacing.sm,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  viewToggleButtonActive: { backgroundColor: colors.primary },
  viewToggleText: { fontSize: 13, fontWeight: "600", color: colors.text },
  viewToggleTextActive: { color: "#fff" },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
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
  cardSubscriber: { borderWidth: 1.5, borderColor: colors.primary, ...shadows.raised },
  avatarRing: { borderRadius: 28, padding: 2 },
  avatarRingSubscriber: { borderRadius: 28, padding: 2, borderWidth: 2, borderColor: colors.primary },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cardName: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  cardTask: { fontSize: 12, color: colors.primary, marginTop: 2, fontWeight: "600" },
});
