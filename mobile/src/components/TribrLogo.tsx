import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function TribrLogo({ light = true }: { light?: boolean }) {
  return (
    <View style={styles.row}>
      <Image source={require("../../assets/icon.png")} style={styles.mark} resizeMode="contain" />
      <Text style={[styles.word, { color: light ? "#fff" : "#2B2420" }]}>Tribr</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 56, height: 56 },
  word: { fontSize: 26, fontWeight: "800" },
});
