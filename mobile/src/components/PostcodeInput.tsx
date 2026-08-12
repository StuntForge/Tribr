import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { reverseGeocode, searchPlaces } from "../api/geocode";
import { colors, radii, spacing } from "../theme";

export interface ResolvedLocation {
  postcode: string;
  label: string;
  lat: number;
  lng: number;
}

// Live address/place autocomplete backed by OpenStreetMap's Nominatim
// (proxied through the backend - see api/geocode.ts), verified against a
// real place database so results land in the right spot on the map. Prop
// names are kept from the original UK-postcode-only version (postcodes.io)
// rather than renamed, since every screen that uses this component only
// cares about the resolved {label, lat, lng} - swapping the search provider
// needed no changes anywhere else.
export default function PostcodeInput({
  postcode,
  onChangePostcode,
  onResolved,
  placeholder = "Start typing an address or place…",
}: {
  postcode: string;
  onChangePostcode: (v: string) => void;
  onResolved: (result: ResolvedLocation) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchedEmpty, setSearchedEmpty] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow, stale search response landing after the user has
  // already picked a suggestion or kept typing past it.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = postcode.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setSearching(false);
      setSearchFailed(false);
      setSearchedEmpty(false);
      return;
    }
    setSearching(true);
    setSearchFailed(false);
    setSearchedEmpty(false);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      // The backend is on Render's free tier, which can take 30-50s to wake
      // from a cold start - give it real time to respond rather than making
      // the search look broken, but don't hang forever either.
      const timeoutController = new AbortController();
      const timeout = setTimeout(() => timeoutController.abort(), 45000);
      try {
        const results = await searchPlaces(query, timeoutController.signal);
        clearTimeout(timeout);
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setSuggestions(results);
        setSearchedEmpty(results.length === 0);
      } catch {
        clearTimeout(timeout);
        if (!mountedRef.current || requestIdRef.current !== requestId) return;
        setSuggestions([]);
        setSearchFailed(true);
      } finally {
        clearTimeout(timeout);
        if (mountedRef.current && requestIdRef.current === requestId) setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcode]);

  const selectSuggestion = (s: { label: string; lat: number; lng: number }) => {
    requestIdRef.current++; // invalidate any in-flight search
    setSuggestions([]);
    setSearchFailed(false);
    setSearchedEmpty(false);
    setError(null);
    onChangePostcode(s.label);
    onResolved({ postcode: s.label, label: s.label, lat: s.lat, lng: s.lng });
  };

  const useCurrentLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location access is needed to find your address automatically.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const result = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      if (!result) {
        setError("Couldn't find an address for your location. Enter it manually instead.");
        return;
      }
      selectSuggestion(result);
    } catch {
      setError("Couldn't determine your location. Enter your address manually instead.");
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
        placeholder={placeholder}
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

      {searching && <Text style={styles.hint}>Searching…</Text>}
      {!searching && searchFailed && (
        <Text style={styles.error}>Couldn't reach the location search. Check your connection and keep typing to retry.</Text>
      )}
      {!searching && !searchFailed && searchedEmpty && (
        <Text style={styles.hint}>No matching places found - try a different spelling or a nearby town.</Text>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.lat},${s.lng},${i}`}
              style={[styles.suggestionRow, i !== suggestions.length - 1 && styles.suggestionRowDivider]}
              onPress={() => selectSuggestion(s)}
            >
              <Ionicons name="location-outline" size={15} color={colors.textMuted} />
              <Text style={styles.suggestionText} numberOfLines={2}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
  suggestionList: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm },
  suggestionRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { flex: 1, fontSize: 13, color: colors.text },
});
