import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme";

export interface ResolvedLocation {
  postcode: string;
  label: string;
  lat: number;
  lng: number;
}

// postcodes.io is a free, keyless, open-data UK postcode API - used instead
// of expo-location's native reverse/forward geocoding so typing a postcode
// works with just a network call (no location permission needed), and so
// "use my current location" only needs raw GPS coords from expo-location,
// not its native geocoder.
async function lookupPostcode(raw: string): Promise<ResolvedLocation | null> {
  const postcode = raw.trim();
  if (!postcode) return null;
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  const json = await res.json();
  if (json.status !== 200 || !json.result) return null;
  const r = json.result;
  return {
    postcode: r.postcode,
    label: [r.admin_district, r.postcode].filter(Boolean).join(", "),
    lat: r.latitude,
    lng: r.longitude,
  };
}

async function reverseLookup(lat: number, lng: number): Promise<ResolvedLocation | null> {
  const res = await fetch(`https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}&limit=1`);
  const json = await res.json();
  const r = json.result?.[0];
  if (!r) return null;
  return {
    postcode: r.postcode,
    label: [r.admin_district, r.postcode].filter(Boolean).join(", "),
    lat: r.latitude,
    lng: r.longitude,
  };
}

export default function PostcodeInput({
  postcode,
  onChangePostcode,
  onResolved,
  placeholder = "e.g. BS1 4ST",
}: {
  postcode: string;
  onChangePostcode: (v: string) => void;
  onResolved: (result: ResolvedLocation) => void;
  placeholder?: string;
}) {
  const [checking, setChecking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPostcode = async (value: string) => {
    if (!value.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const result = await lookupPostcode(value);
      if (!result) {
        setError("That doesn't look like a valid UK postcode.");
        return;
      }
      onChangePostcode(result.postcode);
      onResolved(result);
    } catch {
      setError("Couldn't check that postcode - check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  const useCurrentLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location access is needed to find your postcode automatically.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const result = await reverseLookup(position.coords.latitude, position.coords.longitude);
      if (!result) {
        setError("Couldn't find a postcode for your location. Enter it manually instead.");
        return;
      }
      onChangePostcode(result.postcode);
      onResolved(result);
    } catch {
      setError("Couldn't determine your location. Enter your postcode manually instead.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={postcode}
        onChangeText={(v) => {
          onChangePostcode(v);
          setError(null);
        }}
        onBlur={() => checkPostcode(postcode)}
        placeholder={placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={useCurrentLocation} style={styles.linkButton} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.linkRow}>
            <Ionicons name="locate" size={14} color={colors.primary} />
            <Text style={styles.linkButtonText}>Use my current location</Text>
          </View>
        )}
      </TouchableOpacity>
      {checking && <Text style={styles.hint}>Checking postcode…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
  },
  linkButton: { marginTop: spacing.sm },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  linkButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
});
