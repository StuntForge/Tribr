import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

export default function SortSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SortOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)}>
        <Ionicons name="swap-vertical" size={14} color={colors.text} />
        <Text style={styles.buttonText}>Sort: {selectedLabel}</Text>
        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.title}>Sort by</Text>
            {options.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={styles.row}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.rowText, o.value === value && styles.rowTextSelected]}>{o.label}</Text>
                {o.value === value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
  },
  buttonText: { fontSize: 12, fontWeight: "600", color: colors.text },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: 15, color: colors.text },
  rowTextSelected: { color: colors.primary, fontWeight: "700" },
});
