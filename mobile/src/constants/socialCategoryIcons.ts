import { Ionicons } from "@expo/vector-icons";

// Social Tribe categories use Ionicons rather than commissioned illustrations
// (like categoryThumbnails.ts uses for Work categories) - avoids blocking
// this feature on new art assets. Falls back gracefully like Work's does:
// callers should render a generic icon for an unmapped/unknown name.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Hangout: "people",
  "Food & Drink": "restaurant",
  Music: "musical-notes",
  Games: "game-controller",
  "Sports & Fitness": "basketball",
  Outdoors: "trail-sign",
  Events: "calendar",
  Culture: "color-palette",
  "Classes & Learning": "school",
  Pets: "paw",
  Family: "home",
  Other: "ellipsis-horizontal-circle",
};

export function socialCategoryIcon(categoryName: string | null | undefined): keyof typeof Ionicons.glyphMap {
  return (categoryName ? ICONS[categoryName] : undefined) ?? "people";
}
