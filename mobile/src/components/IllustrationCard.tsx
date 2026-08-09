import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { radii } from "../theme";

// The supplied illustrations are exported on a dark "glow" card (only the
// four corners are truly transparent - see scripts/process-illustrations.js
// for why a clean cutout isn't possible without damaging dark hair/clothing
// detail), so they're shown inside a matching near-black rounded card
// rather than directly on light backgrounds.
export default function IllustrationCard({
  source,
  width,
  aspectRatio,
  rounded = radii.lg,
}: {
  source: ImageSourcePropType;
  width: number;
  aspectRatio: number;
  rounded?: number;
}) {
  return (
    <View style={[styles.card, { width, height: width / aspectRatio, borderRadius: rounded }]}>
      <Image source={source} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#0B0F0C", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
