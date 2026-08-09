import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

const WAVE_BAND = 34;

// Dark green header block with a soft wavy bottom edge (used at the top of
// every top-level screen). The wave is faked rather than clipped: the green
// box is drawn a bit taller than its content, and a background-colored wave
// shape is layered over its lower edge, so the visible green silhouette
// reads as wavy instead of a hard rectangle.
export default function WaveHeader({
  children,
  illustration,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  illustration?: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.content, { paddingTop: insets.top + 12 }, contentStyle]}>{children}</View>
      <View style={styles.waveBand} pointerEvents="none">
        <Svg width="100%" height={WAVE_BAND} viewBox="0 0 400 34" preserveAspectRatio="none">
          <Path d="M0,16 C110,40 290,-10 400,14 L400,34 L0,34 Z" fill={colors.background} />
        </Svg>
      </View>
      {illustration && <View style={styles.illustration}>{illustration}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingBottom: WAVE_BAND * 0.6,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  illustration: {
    position: "absolute",
    bottom: 30,
    right: 10,
  },
  waveBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -2,
  },
});
