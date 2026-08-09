import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import IllustrationCircle from "./illustrations/IllustrationCircle";
import { colors, radii, spacing, type } from "../theme";

export default function EmptyState({
  icon,
  badgeIcon,
  title,
  body,
  tint = colors.surfaceAlt,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0, scale: 0.85, translateY: 8 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 450 }}
      >
        <IllustrationCircle size={132} tint={tint}>
          <Ionicons name={icon} size={52} color={colors.primary} />
        </IllustrationCircle>
        {badgeIcon && (
          <View style={styles.badge}>
            <Ionicons name={badgeIcon} size={16} color="#fff" />
          </View>
        )}
      </MotiView>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  badge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  title: { ...type.h3, marginTop: spacing.md, marginBottom: spacing.xs, textAlign: "center" },
  body: { ...type.body, color: colors.textMuted, textAlign: "center", lineHeight: 21, maxWidth: 300 },
});
