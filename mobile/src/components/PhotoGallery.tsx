import React, { useState } from "react";
import { Image, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { radii, spacing } from "../theme";

export interface Photo {
  id: string;
  url: string;
}

// Thumbnail grid + full-screen viewer. Tap a thumbnail to expand it; tap
// anywhere outside the expanded image to close it again.
export default function PhotoGallery({ photos, thumbSize = 100 }: { photos: Photo[]; thumbSize?: number }) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <View style={styles.row}>
        {photos.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setExpandedUrl(p.url)} accessibilityRole="imagebutton" accessibilityLabel="View photo">
            <Image source={{ uri: p.url }} style={[styles.thumb, { width: thumbSize, height: thumbSize }]} />
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={expandedUrl != null} transparent animationType="fade" onRequestClose={() => setExpandedUrl(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setExpandedUrl(null)}>
          {expandedUrl && <Image source={{ uri: expandedUrl }} style={styles.expanded} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumb: { borderRadius: radii.md },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  expanded: { width: "100%", height: "80%" },
});
