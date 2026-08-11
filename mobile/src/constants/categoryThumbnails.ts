// A Tribe can allow multiple job categories, which made "what icon
// represents this Tribe" ambiguous - instead every Tribe's icon is keyed off
// its leader's own task category, which is always a single, unambiguous
// answer.
const THUMBNAILS: Record<string, any> = {
  Gardening: require("../../assets/illustrations/gardening-thumbnail.png"),
  "Moving & Lifting": require("../../assets/illustrations/moveing-thumbnail.png"),
  "DIY & General": require("../../assets/illustrations/diy-thumbnail.png"),
  Decorating: require("../../assets/illustrations/painting-thumbnail.png"),
};

export function categoryThumbnail(categoryName: string | null | undefined) {
  return (categoryName && THUMBNAILS[categoryName]) ?? null;
}
