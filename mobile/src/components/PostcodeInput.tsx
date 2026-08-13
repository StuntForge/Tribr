import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { resolvePlace, searchPlaces, PlaceSuggestion } from "../api/geocode";
import { colors, radii, spacing } from "../theme";

export interface ResolvedLocation {
  postcode: string;
  label: string;
  lat: number;
  lng: number;
}

// A fresh random id per search - not a real UUID, just needs to be unique
// enough to tell Google's billing system "these keystrokes + this one
// Place Details call are all the same search." No crypto library needed
// for that, so none was added (avoids an otherwise-unnecessary native
// rebuild).
function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Live address/place autocomplete backed by Google Places API (New)
// (proxied through the backend - see api/geocode.ts). Prop names are kept
// from the original UK-postcode-only version (postcodes.io) rather than
// renamed, since every screen that uses this component only cares about
// the resolved {label, lat, lng} - swapping the search provider (twice now)
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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
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

  // One token per search "session" - created the moment a new search
  // starts, reused for every keystroke in it and the final resolve() call,
  // then thrown away. Reusing it past that (or never generating one) is
  // what would silently push billing onto the metered per-keystroke tier
  // instead of the free session one.
  const sessionTokenRef = useRef<string | null>(null);

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
    if (!sessionTokenRef.current) sessionTokenRef.current = newSessionToken();
    setSearching(true);
    setSearchFailed(false);
    setSearchedEmpty(false);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const timeoutController = new AbortController();
      const timeout = setTimeout(() => timeoutController.abort(), 15000);
      try {
        const results = await searchPlaces(query, sessionTokenRef.current!, timeoutController.signal);
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

  const selectSuggestion = async (s: PlaceSuggestion) => {
    requestIdRef.current++; // invalidate any in-flight search
    setSuggestions([]);
    setSearchFailed(false);
    setSearchedEmpty(false);
    setError(null);
    onChangePostcode(s.label);
    const sessionToken = sessionTokenRef.current ?? newSessionToken();
    setResolving(true);
    try {
      const resolved = await resolvePlace(s.placeId, sessionToken);
      onResolved({ postcode: resolved.label || s.label, label: resolved.label || s.label, lat: resolved.lat, lng: resolved.lng });
    } catch {
      setError("Couldn't confirm that place's location - please try again.");
    } finally {
      setResolving(false);
      // Session is over either way (selected, or failed to resolve) - the
      // next search starts a fresh one.
      sessionTokenRef.current = null;
    }
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
      // Used directly rather than reverse-geocoded into a readable address -
      // the coordinates are already exactly what radius search needs, and
      // skipping that extra lookup keeps this free and removes a step that
      // was failing outright before.
      onChangePostcode("Current location");
      onResolved({ postcode: "Current location", label: "Current location", lat: position.coords.latitude, lng: position.coords.longitude });
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
      {resolving && <Text style={styles.hint}>Confirming location…</Text>}
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
              key={s.placeId}
              style={[styles.suggestionRow, i !== suggestions.length - 1 && styles.suggestionRowDivider]}
              onPress={() => selectSuggestion(s)}
              disabled={resolving}
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
