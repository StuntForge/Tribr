import React from "react";
import { Image, ImageSourcePropType, StyleSheet } from "react-native";

// The illustrations are processed (scripts/process-illustrations.js) to a
// real transparent background via flood-fill, so they sit directly on
// whatever's behind them - no card/backdrop needed.
export default function IllustrationCard({
  source,
  width,
  aspectRatio,
}: {
  source: ImageSourcePropType;
  width: number;
  aspectRatio: number;
  /** @deprecated no longer renders a card background; kept so existing call sites don't need edits. */
  rounded?: number;
}) {
  return (
    <Image
      source={source}
      style={[styles.image, { width, height: width / aspectRatio }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  image: {},
});
