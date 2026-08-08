import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

// A palette of warm, muted tones (siblings of the accent color) so initials
// avatars feel intentional rather than random-hash ugly.
const PALETTE = ["#C1694F", "#3D6B52", "#B08B3F", "#8C6A56", "#5C7A8A", "#A05A6E"];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ name, photoUrl, size = 48 }: { name: string | null | undefined; photoUrl?: string | null; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const bg = colorFor(name ?? "?");

  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#eee" },
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "700" },
});
