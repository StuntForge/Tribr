import React, { useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";

const AGE_OPTIONS = Array.from({ length: 99 - 18 + 1 }, (_, i) => 18 + i);

// Single required age value, 18-99. For the "Any" + min/max range picker
// used on Create Group, see the local AgeSelect in CreateGroupScreen.
export default function AgeSelect({
  value,
  onChange,
  placeholder = "Select your age",
}: {
  value: number | null;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)}>
        <Text style={[styles.buttonText, value == null && styles.placeholder]}>{value ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.title}>Age</Text>
            <FlatList
              data={AGE_OPTIONS}
              keyExtractor={(n) => String(n)}
              style={styles.list}
              initialScrollIndex={value != null ? Math.max(0, value - 18 - 2) : 0}
              getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.rowText, item === value && styles.rowTextSelected]}>{item}</Text>
                  {item === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
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
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
  },
  buttonText: { fontSize: 15, color: colors.text },
  placeholder: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "60%",
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  list: { maxHeight: 320 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { fontSize: 15, color: colors.text },
  rowTextSelected: { color: colors.primary, fontWeight: "700" },
});
