import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { updateMe } from "../../api/profile";
import { uploadPhoto } from "../../api/uploads";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];

export default function CreateProfileScreen() {
  const { refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(undefined);
  const [homeAddress, setHomeAddress] = useState("");
  const [bio, setBio] = useState("");
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to choose a profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoLocalUri(result.assets[0].uri);
      try {
        const { url } = await uploadPhoto(result.assets[0].uri);
        setPhotoUrl(url);
      } catch (e: any) {
        setError(e.message ?? "Could not upload photo.");
      }
    }
  };

  const useCurrentLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location access is needed to find helpers near you.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocationLat(position.coords.latitude);
      setLocationLng(position.coords.longitude);
      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const place = places[0];
      if (place) {
        setLocationLabel([place.city, place.region].filter(Boolean).join(", "));
      }
    } catch {
      setError("Could not determine your location. You can type it manually instead.");
    } finally {
      setLocating(false);
    }
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    age.trim().length > 0 &&
    gender &&
    locationLabel.trim().length > 0 &&
    bio.trim().length > 0 &&
    photoUrl;

  const onSubmit = async () => {
    setError(null);
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 16 || ageNum > 120) {
      setError("Enter a valid age.");
      return;
    }
    setSubmitting(true);
    try {
      await updateMe({
        firstName: firstName.trim(),
        age: ageNum,
        gender: gender!,
        locationLabel: locationLabel.trim(),
        locationLat,
        locationLng,
        homeAddress: homeAddress.trim() || undefined,
        bio: bio.trim(),
        profilePhotoUrl: photoUrl!,
      });
      await refreshProfile();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create your profile</Text>
      <Text style={styles.subtitle}>
        This builds the trust every group relies on. Your exact address is never shown to anyone.
      </Text>

      <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
        {photoLocalUri ? (
          <Image source={{ uri: photoLocalUri }} style={styles.photo} />
        ) : (
          <Text style={styles.photoPickerText}>Add profile photo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>First name</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Alex" />

      <Text style={styles.label}>Age</Text>
      <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="35" keyboardType="number-pad" />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.chipRow}>
        {GENDER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, gender === option && styles.chipSelected]}
            onPress={() => setGender(option)}
          >
            <Text style={[styles.chipText, gender === option && styles.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Approximate location</Text>
      <TextInput
        style={styles.input}
        value={locationLabel}
        onChangeText={setLocationLabel}
        placeholder="Bristol, UK"
      />
      <TouchableOpacity onPress={useCurrentLocation} style={styles.linkButton}>
        {locating ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.linkButtonText}>Use my current location</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Home address (optional, private)</Text>
      <Text style={styles.hint}>
        Only shared with your group, for a task at your home, once a work date is confirmed. Never shown publicly.
      </Text>
      <TextInput
        style={styles.input}
        value={homeAddress}
        onChangeText={setHomeAddress}
        placeholder="12 Example Street, Bristol, BS1 1AA"
      />

      <Text style={styles.label}>Biography</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell other members a bit about yourself and the projects you enjoy."
        multiline
        numberOfLines={4}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Finish profile</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },
  photoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoPickerText: { color: colors.primary, fontSize: 12, textAlign: "center", paddingHorizontal: spacing.sm },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  linkButton: { marginTop: spacing.sm },
  linkButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
