import { v2 as cloudinary } from "cloudinary";

export { cloudinary };

// Only the resulting URL is stored anywhere (no separate public_id column),
// so deleting a photo later means pulling its public_id back out of that
// URL - Cloudinary URLs are always .../upload/[v<version>/]<public_id>.<ext>.
export function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

export async function deleteCloudinaryImage(url: string) {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId).catch(() => {});
}
