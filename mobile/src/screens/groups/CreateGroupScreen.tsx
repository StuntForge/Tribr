import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroup } from "../../api/groups";
import { getJobCategories, getMyTasks } from "../../api/tasks";
import TaskSelectRow from "../../components/TaskSelectRow";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import AnimatedPressable from "../../components/AnimatedPressable";
import FieldLabel from "../../components/FieldLabel";
import IllustrationCard from "../../components/IllustrationCard";
import { colors, radii, spacing } from "../../theme";

const HEADER_IMAGE = require("../../../assets/illustrations/processed/create-group-header.png");

const SIZE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "3–4", min: 3, max: 4 },
  { label: "4–6", min: 4, max: 6 },
  { label: "6–8", min: 6, max: 8 },
];

const RATING_OPTIONS = [null, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const AGE_OPTIONS: (number | null)[] = [null, ...Array.from({ length: 99 - 18 + 1 }, (_, i) => 18 + i)];

export default function CreateGroupScreen({ route, navigation }: any) {
  const blocked = Boolean(route.params?.blocked);
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories, enabled: !blocked });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks, enabled: !blocked });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [sizePreset, setSizePreset] = useState(SIZE_PRESETS[0]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [ageMin, setAgeMin] = useState<number | null>(null);
  const [ageMax, setAgeMax] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    setTaskId(null);
  };

  const availableTasks = (tasks ?? []).filter((t) => t.status === "AVAILABLE" && categoryIds.includes(t.category.id));

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      navigation.replace("GroupDetail", { groupId: group.id });
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const Header = (
    <WaveHeader illustration={<IllustrationCard source={HEADER_IMAGE} width={170} aspectRatio={1449 / 796} />}>
      <View style={styles.topRow}>
        <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </AnimatedPressable>
        <TribrLogo />
      </View>
      <Text style={styles.title}>Form a Tribe</Text>
      <Text style={styles.subtitle}>Set up your Tribe and invite others to get things done together.</Text>
    </WaveHeader>
  );

  if (blocked) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.center}>
          <Text style={styles.blockedTitle}>Subscribers only</Text>
          <Text style={styles.blockedBody}>
            Forming a Tribe is a Subscriber feature. Free members can still browse and apply to Tribes.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Profile", { screen: "Subscription" })}
          >
            <Text style={styles.primaryButtonText}>View subscription options</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const onSubmit = () => {
    if (!name.trim()) return setError("Give the Tribe a name.");
    if (!description.trim()) return setError("Add a short description.");
    if (categoryIds.length === 0) return setError("Choose at least one allowed category.");
    if (!taskId) return setError("Choose one of your available tasks to represent you.");
    if (ageMin != null && ageMax != null && ageMin > ageMax) {
      return setError("Minimum age can't be greater than the maximum.");
    }
    setError(null);
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      categoryIds,
      sizeMin: sizePreset.min,
      sizeMax: sizePreset.max,
      taskId,
      verifiedOnly,
      minRating: minRating ?? undefined,
      preferredAgeMin: ageMin ?? undefined,
      preferredAgeMax: ageMax ?? undefined,
    });
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
      {Header}
      <View style={styles.form}>
        <FieldLabel icon="people" label="Tribe name" />
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Bristol Garden Crew" />

        <FieldLabel icon="reader" label="Description" />
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="What kind of projects is this Tribe for?"
          multiline
        />

        <FieldLabel icon="pricetag" label="Allowed categories" />
        <Text style={styles.hint}>Members can only join (or be invited) with a task in one of these categories.</Text>
        <View style={styles.chipRow}>
          {categories?.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, categoryIds.includes(c.id) && styles.chipSelected]}
              onPress={() => toggleCategory(c.id)}
            >
              <Text style={[styles.chipText, categoryIds.includes(c.id) && styles.chipTextSelected]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel icon="people-circle" label="Tribe size" />
        <View style={styles.chipRow}>
          {SIZE_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={[styles.chip, sizePreset.label === preset.label && styles.chipSelected]}
              onPress={() => setSizePreset(preset)}
            >
              <Text style={[styles.chipText, sizePreset.label === preset.label && styles.chipTextSelected]}>
                {preset.label} members
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <FieldLabel icon="shield-checkmark" label="Verified members only" />
            <Text style={styles.hint}>Only members who've completed at least one cycle before can apply.</Text>
          </View>
          <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{ true: colors.primary }} />
        </View>

        <FieldLabel icon="star" label="Minimum rating to apply" />
        <View style={styles.chipRow}>
          {RATING_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r ?? "any"}
              style={[styles.chip, minRating === r && styles.chipSelected]}
              onPress={() => setMinRating(r)}
            >
              <Text style={[styles.chipText, minRating === r && styles.chipTextSelected]}>{r == null ? "Any" : `${r.toFixed(1)}★`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel icon="person" label="Preferred age range" />
        <Text style={styles.hint}>Only people within this range will see or be able to join this Tribe.</Text>
        <View style={styles.ageRow}>
          <AgeSelect label="Min age" value={ageMin} onChange={setAgeMin} />
          <Text style={styles.ageSeparator}>–</Text>
          <AgeSelect label="Max age" value={ageMax} onChange={setAgeMax} />
        </View>

        <FieldLabel icon="clipboard" label="Your task for this Tribe" />
        {categoryIds.length === 0 ? (
          <Text style={styles.hint}>Choose at least one allowed category first.</Text>
        ) : availableTasks.length === 0 ? (
          <Text style={styles.hint}>
            You don't have an available task in an allowed category. Add one from your Task Library first.
          </Text>
        ) : (
          <View>
            {availableTasks.map((t) => (
              <TaskSelectRow key={t.id} task={t} selected={taskId === t.id} onSelect={() => setTaskId(t.id)} navigation={navigation} />
            ))}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Form Tribe</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

function AgeSelect({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.ageSelectButton} onPress={() => setOpen(true)}>
        <Text style={styles.ageSelectText}>
          {label}: {value ?? "Any"}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>{label}</Text>
            <FlatList
              data={AGE_OPTIONS}
              keyExtractor={(n) => String(n)}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, item === value && styles.pickerRowTextSelected]}>{item ?? "Any"}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4, lineHeight: 18, maxWidth: "80%" },
  headerIllustration: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    margin: 18,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  blockedTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  blockedBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  content: { paddingBottom: spacing.xl },
  form: { paddingHorizontal: spacing.lg },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ageRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ageSeparator: { color: colors.textMuted },
  ageSelectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  ageSelectText: { fontSize: 14, color: colors.text },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: "60%" },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  pickerList: { maxHeight: 320 },
  pickerRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowText: { fontSize: 15, color: colors.text },
  pickerRowTextSelected: { color: colors.primary, fontWeight: "700" },
  error: { color: colors.danger, marginTop: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
