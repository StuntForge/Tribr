import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";
import { colors, spacing, type } from "../theme";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  title: string;
  snippet: string;
}

// Leaflet + OpenStreetMap tiles inside a WebView - no native map SDK, no API
// key, and it runs fine in Expo Go (unlike expo-maps / react-native-maps,
// which both require a custom dev client to load their native module).
function buildMapHtml(center: { lat: number; lng: number }, markers: MapMarker[], markerColor: string) {
  const markersJs = JSON.stringify(markers);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .leaflet-popup-content { font-family: -apple-system, Roboto, sans-serif; font-size: 13px; }
    .flag-icon { background: none; border: none; }
    .flag-pole { position: absolute; left: 3px; bottom: 0; width: 2px; height: 24px; background: #4a4a4a; }
    .flag-banner {
      position: absolute;
      left: 5px;
      bottom: 17px;
      background: ${markerColor};
      color: #fff;
      font-family: -apple-system, Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 2px 8px 8px 2px;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.35);
    }
    .flag-dot { position: absolute; left: 0px; bottom: -3px; width: 8px; height: 8px; border-radius: 50%; background: #4a4a4a; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    const map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.circleMarker([${center.lat}, ${center.lng}], { radius: 7, color: '${colors.accent}', fillColor: '${colors.accent}', fillOpacity: 1 }).addTo(map);
    const markers = ${markersJs};
    const bounds = [[${center.lat}, ${center.lng}]];
    markers.forEach(function(m) {
      const icon = L.divIcon({
        className: 'flag-icon',
        html: '<div class="flag-dot"></div><div class="flag-pole"></div><div class="flag-banner">' + escapeHtml(m.label) + '</div>',
        iconSize: [140, 28],
        iconAnchor: [4, 24],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      // A native card (with the group's real category image, which a
      // Leaflet HTML popup can't render reliably) replaces the old
      // text-only Leaflet popup - tapping the flag selects it directly.
      marker.on('click', function() { select(m.id); });
      bounds.push([m.lat, m.lng]);
    });
    // Frame every marker (not a fixed zoom around the viewer) so results far
    // from the viewer's own location - a real possibility once testers
    // aren't all clustered around the same seeded demo area - aren't left
    // sitting off-screen looking like they're missing.
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    } else {
      map.setView([${center.lat}, ${center.lng}], 9);
    }
    function select(id) {
      window.ReactNativeWebView.postMessage(id);
    }
  </script>
</body>
</html>`;
}

export default function LocationMap({
  markers,
  center,
  markerColor = colors.primary,
  onSelectMarker,
}: {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  markerColor?: string;
  onSelectMarker: (id: string) => void;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, styles.webFallback]}>
        <Text style={styles.webFallbackText}>Map view is available on the mobile app.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        originWhitelist={["*"]}
        source={{ html: buildMapHtml(center, markers, markerColor) }}
        onMessage={(event) => onSelectMarker(event.nativeEvent.data)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  webFallback: { alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.surfaceAlt },
  webFallbackText: { ...type.body, color: colors.textMuted, textAlign: "center" },
});
