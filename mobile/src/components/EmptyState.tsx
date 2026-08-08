import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import Blob from "./illustrations/Blob";
import { colors, spacing, type } from "../theme";

export default function EmptyState({
  icon,
  title,
  body,
  variant = 0,
  tint = colors.primary,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  variant?: 0 | 1;
  tint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0, scale: 0.85, translateY: 8 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 450 }}
        style={styles.blobWrap}
      >
        <Blob size={112} color={tint} variant={variant} />
        <View style={styles.iconOverlay}>
          <Ionicons name={icon} size={40} color="#fff" />
        </View>
      </MotiView>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  blobWrap: { alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  iconOverlay: { position: "absolute" },
  title: { ...type.h3, marginBottom: spacing.xs, textAlign: "center" },
  body: { ...type.body, color: colors.textMuted, textAlign: "center", lineHeight: 21, maxWidth: 300 },
});
