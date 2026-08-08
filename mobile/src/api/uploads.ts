import { API_BASE_URL } from "../config";
import { getToken } from "./client";

export async function uploadPhoto(localUri: string): Promise<{ url: string }> {
  const token = await getToken();
  const form = new FormData();
  const filename = localUri.split("/").pop() ?? "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  const type = ext === "png" ? "image/png" : "image/jpeg";

  // React Native's FormData accepts this shape for file uploads.
  form.append("file", { uri: localUri, name: filename, type } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "multipart/form-data",
      "ngrok-skip-browser-warning": "true",
    },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
  return { url: `${API_BASE_URL}${data.url}` };
}
