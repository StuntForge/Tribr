import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Task } from "../api/tasks";
import { categoryThumbnail } from "../constants/categoryThumbnails";
import { colors, radii, spacing } from "../theme";

// Shared "pick one of my tasks" row - full name/category/description plus
// View and Select buttons, rather than a small chip. Used anywhere a user
// chooses a task to represent them (creating a group, applying to one).
export default function TaskSelectRow({
  task,
  selected,
  onSelect,
  navigation,
  disabled,
  disabledReason,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  navigation: any;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const thumbUrl = task.photos[0]?.url;

  return (
    <View style={[styles.taskRow, selected && styles.taskRowSelected, disabled && styles.taskRowDisabled]}>
      {thumbUrl ? (
        <Image source={{ uri: thumbUrl }} style={styles.taskRowThumb} />
      ) : (
        <Image source={categoryThumbnail(task.category.name)} style={styles.taskRowThumb} resizeMode="contain" />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.taskRowTitle}>{task.name}</Text>
        <Text style={styles.taskRowCategory}>{task.category.name}</Text>
        <Text style={styles.taskRowDescription} numberOfLines={2}>
          {task.description}
        </Text>
        {disabled && disabledReason && <Text style={styles.taskRowDisabledReason}>{disabledReason}</Text>}
      </View>
      <View style={styles.taskRowActions}>
        <TouchableOpacity style={styles.viewButton} onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}>
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectButton, selected && styles.selectButtonActive, disabled && styles.selectButtonDisabled]}
          onPress={onSelect}
          disabled={disabled}
        >
          <Text style={[styles.selectButtonText, selected && styles.selectButtonTextActive]}>{selected ? "Selected" : "Select"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  taskRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  taskRowThumb: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  taskRowSelected: { borderColor: colors.primary, borderWidth: 2 },
  taskRowDisabled: { opacity: 0.5 },
  taskRowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  taskRowCategory: { fontSize: 11, fontWeight: "600", color: colors.primary, marginTop: 2 },
  taskRowDescription: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  taskRowDisabledReason: { fontSize: 11, color: colors.danger, fontWeight: "600", marginTop: 4 },
  taskRowActions: { justifyContent: "center", gap: spacing.xs },
  viewButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  viewButtonText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  selectButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  selectButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectButtonDisabled: { opacity: 0.5 },
  selectButtonText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  selectButtonTextActive: { color: "#fff" },
});
