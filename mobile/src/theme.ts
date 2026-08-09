// Design direction: professional but homey — a community app, not a banking
// app. Warm and grounded rather than cold/corporate; rounded and a little
// tactile rather than flat; not childish or cartoonish.

export const colors = {
  background: "#FAF6EF", // warm cream, not stark white/gray
  surface: "#FFFFFF",
  surfaceAlt: "#E9EEE7", // subtle sage section tint (info cards, active/selected rows)

  primary: "#1B3A2C", // deep pine green — headers, tab bar, primary buttons
  primaryDark: "#0F241C",
  primaryLight: "#E1E9E3", // selected chips, subtle highlights

  accent: "#D97B4F", // terracotta — active tab highlight, links, CTA accents
  accentLight: "#F5E2DA",

  text: "#2B2420", // warm near-black, not clinical pure black
  textMuted: "#78695D",
  border: "#E8E0D3",

  danger: "#B8463A",
  dangerLight: "#F5E0DC",
  star: "#D9A441",
  proAccent: "#F0C869", // warm gold accent used inside the Pro badge
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

// RN shadows need both the iOS shadow* props and Android's elevation.
export const shadows = {
  card: {
    shadowColor: "#3A2E22",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: "#3A2E22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
};

// A shared type scale so text sizing/weight stays consistent instead of
// ad-hoc fontSize values scattered per-screen.
export const type = {
  h1: { fontSize: 26, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text },
  bodyMedium: { fontSize: 15, fontWeight: "600" as const, color: colors.text },
  small: { fontSize: 13, fontWeight: "400" as const, color: colors.textMuted },
  smallMedium: { fontSize: 13, fontWeight: "600" as const, color: colors.text },
  caption: { fontSize: 12, fontWeight: "400" as const, color: colors.textMuted },
};
