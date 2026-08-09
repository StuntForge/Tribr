import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// Small in-header brand mark: two overlapping leaf glyphs (sage + terracotta,
// echoing the app icon's two-tone leaf motif) next to the wordmark. The
// actual app icon/splash asset is a native change tracked separately.
export default function TribrLogo({ light = true }: { light?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Ionicons name="leaf" size={14} color={colors.primaryLight} style={styles.leafLeft} />
        <Ionicons name="leaf" size={14} color={colors.accent} style={styles.leafRight} />
      </View>
      <Text style={[styles.word, { color: light ? "#fff" : colors.text }]}>Tribr</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  mark: { width: 26, height: 22, alignItems: "center", justifyContent: "center" },
  leafLeft: { position: "absolute", left: 0, transform: [{ rotate: "-20deg" }] },
  leafRight: { position: "absolute", right: 0, transform: [{ rotate: "20deg" }, { scaleX: -1 }] },
  word: { fontSize: 20, fontWeight: "800" },
});
