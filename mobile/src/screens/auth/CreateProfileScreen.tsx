import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as ImagePicker from "expo-image-picker";
import { updateMe } from "../../api/profile";
import { uploadPhoto } from "../../api/uploads";
import { useAuth } from "../../context/AuthContext";
import AgeSelect from "../../components/AgeSelect";
import PostcodeInput from "../../components/PostcodeInput";
import { colors, spacing } from "../../theme";

const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];

export default function CreateProfileScreen() {
  const { refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [postcode, setPostcode] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(undefined);
  const [bio, setBio] = useState("");
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
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

  const onSubmit = async () => {
    setError(null);
    const missing: string[] = [];
    if (!photoUrl) missing.push("profile photo");
    if (!firstName.trim()) missing.push("first name");
    if (age == null) missing.push("age");
    if (!gender) missing.push("gender");
    if (!locationLabel.trim()) missing.push("postcode");
    if (!bio.trim()) missing.push("biography");
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}.`);
      return;
    }
    setSubmitting(true);
    try {
      await updateMe({
        firstName: firstName.trim(),
        age: age!,
        gender: gender!,
        locationLabel: locationLabel.trim(),
        locationLat,
        locationLng,
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
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
      <Text style={styles.title}>Create your profile</Text>
      <Text style={styles.subtitle}>
        This builds the trust every Tribe relies on. Your exact address is never shown to anyone.
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
      <Text style={styles.hint}>Must be accurate - this can't be changed once your account is created.</Text>
      <AgeSelect value={age} onChange={setAge} />

      <Text style={styles.label}>Gender</Text>
      <Text style={styles.hint}>This can't be changed once your account is created.</Text>
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

      <Text style={styles.label}>Postcode</Text>
      <Text style={styles.hint}>Used to find Tribes and helpers near you. Your exact address is never shown.</Text>
      <PostcodeInput
        postcode={postcode}
        onChangePostcode={setPostcode}
        onResolved={(r) => {
          setLocationLabel(r.label);
          setLocationLat(r.lat);
          setLocationLng(r.lng);
        }}
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

      <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Finish profile</Text>}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
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
