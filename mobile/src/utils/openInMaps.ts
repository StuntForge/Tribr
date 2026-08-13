import { Linking } from "react-native";

// Hands off to whatever maps app is already on the phone (Google Maps on
// Android, Apple/Google Maps on iOS) using coordinates we already have -
// no API call, no lookup, no cost. This is deliberately separate from the
// location search/autocomplete flow: we only ever need to resolve a typed
// place to coordinates once, when it's set; showing someone where it is
// afterward never needs a fresh lookup.
export function openInMaps(lat: number, lng: number) {
  Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`).catch(() => {});
}
