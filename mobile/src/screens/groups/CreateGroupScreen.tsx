import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroup } from "../../api/groups";
import { getJobCategories, getMyTasks } from "../../api/tasks";
import { colors, spacing } from "../../theme";

const SIZE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "3–4", min: 3, max: 4 },
  { label: "4–6", min: 4, max: 6 },
  { label: "6–8", min: 6, max: 8 },
];

export default function CreateGroupScreen({ route, navigation }: any) {
  const blocked = Boolean(route.params?.blocked);
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories, enabled: !blocked });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks, enabled: !blocked });
  const availableTasks = tasks?.filter((t) => t.status === "AVAILABLE") ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sizePreset, setSizePreset] = useState(SIZE_PRESETS[0]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      navigation.replace("GroupDetail", { groupId: group.id });
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  if (blocked) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedTitle}>Subscribers only</Text>
        <Text style={styles.blockedBody}>
          Creating a group is a Subscriber feature. Free members can still browse and apply to groups.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Profile", { screen: "Subscription" })}
        >
          <Text style={styles.primaryButtonText}>View subscription options</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onSubmit = () => {
    if (!name.trim()) return setError("Give the group a name.");
    if (!description.trim()) return setError("Add a short description.");
    if (!taskId) return setError("Choose one of your available tasks to represent you.");
    setError(null);
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      categoryId: categoryId ?? undefined,
      sizeMin: sizePreset.min,
      sizeMax: sizePreset.max,
      taskId,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Group name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Bristol Garden Crew" />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="What kind of projects is this group for?"
        multiline
      />

      <Text style={styles.label}>Job category (optional)</Text>
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

      <Text style={styles.label}>Group size</Text>
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

      <Text style={styles.label}>Your task for this group</Text>
      {availableTasks.length === 0 ? (
        <Text style={styles.hint}>You don't have an available task. Add one from your Task Library first.</Text>
      ) : (
        <View style={styles.chipRow}>
          {availableTasks.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, taskId === t.id && styles.chipSelected]}
              onPress={() => setTaskId(t.id)}
            >
              <Text style={[styles.chipText, taskId === t.id && styles.chipTextSelected]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create group</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  blockedTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  blockedBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted },
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
  error: { color: colors.danger, marginTop: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
