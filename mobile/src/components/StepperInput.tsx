import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AnimatedPressable from "./AnimatedPressable";
import { colors, radii, spacing } from "../theme";

export default function StepperInput({
  value,
  onChange,
  min = 1,
  max = 999,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.stepper}>
        <AnimatedPressable
          style={[styles.button, value <= min && styles.buttonDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Ionicons name="remove" size={18} color={value <= min ? colors.textMuted : colors.primary} />
        </AnimatedPressable>
        <Text style={styles.value}>{value}</Text>
        <AnimatedPressable
          style={[styles.button, value >= max && styles.buttonDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Ionicons name="add" size={18} color={value >= max ? colors.textMuted : colors.primary} />
        </AnimatedPressable>
      </View>
      {unit && <Text style={styles.unit}>{unit}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  button: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { opacity: 0.4 },
  value: { minWidth: 36, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.text },
  unit: { fontSize: 11, color: colors.textMuted },
});
