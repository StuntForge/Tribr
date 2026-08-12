import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { setDietary, updateMe } from "../api/profile";
import { uploadPhoto } from "../api/uploads";
import { useAuth } from "../context/AuthContext";
import PostcodeInput from "../components/PostcodeInput";
import WaveHeader from "../components/WaveHeader";
import AnimatedPressable from "../components/AnimatedPressable";
import FieldLabel from "../components/FieldLabel";
import { colors, spacing } from "../theme";

const HEADER_DECORATION = require("../../assets/illustrations/processed/settings-header.png");

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Pescatarian", "No Seafood", "Lactose Intolerant", "Kosher", "Halal", "Food Allergies"];

export default function EditProfileScreen({ navigation }: any) {
  const { profile, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [postcode, setPostcode] = useState("");
  const [locationLabel, setLocationLabel] = useState(profile?.locationLabel ?? "");
  const [locationLat, setLocationLat] = useState<number | undefined>(profile?.locationLat ?? undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(profile?.locationLng ?? undefined);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.profilePhotoUrl ?? null);
  const [dietary, setDietaryState] = useState<string[]>(profile?.dietary ?? []);
  const [allergyDetail, setAllergyDetail] = useState(profile?.allergyDetail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const toggleDietary = (option: string) => {
    setDietaryState((prev) => (prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]));
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to choose a profile photo.");
      return;
    }
    // No allowsEditing - the OS's built-in crop screen renders its controls
    // in a low-contrast overlay that's hard to see. The photo picker circle
    // already crops to a square via resizeMode "cover", so skipping the
    // native crop step loses nothing but the confusing UI.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoLocalUri(result.assets[0].uri);
      setUploadingPhoto(true);
      try {
        const { url } = await uploadPhoto(result.assets[0].uri);
        setPhotoUrl(url);
      } catch (e: any) {
        setError(e.message ?? "Could not upload photo.");
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // canSubmit alone isn't enough - photoUrl still holds the *previous*
  // photo's URL while a newly-picked one is mid-upload, so Save was able to
  // fire early and silently persist the old photo instead of the new one.
  const canSubmit =
    firstName.trim().length > 0 && locationLabel.trim().length > 0 && bio.trim().length > 0 && photoUrl && !uploadingPhoto;

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updateMe({
        firstName: firstName.trim(),
        locationLabel: locationLabel.trim(),
        locationLat,
        locationLng,
        bio: bio.trim(),
        profilePhotoUrl: photoUrl!,
      });
      await setDietary(dietary, allergyDetail.trim() || undefined);
      await refreshProfile();
      navigation.goBack();
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
      <WaveHeader
        contentStyle={styles.headerContent}
        illustration={<Image source={HEADER_DECORATION} style={styles.headerDecoration} resizeMode="contain" />}
      >
        <View style={styles.topRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit || submitting}
            style={styles.headerSaveButton}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="checkmark" size={24} color={canSubmit ? "#fff" : "rgba(255,255,255,0.4)"} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.photoPicker}
          onPress={pickPhoto}
          disabled={uploadingPhoto}
          accessibilityLabel="Change profile photo"
          accessibilityRole="button"
        >
          {photoLocalUri || photoUrl ? (
            <Image source={{ uri: photoLocalUri ?? photoUrl! }} style={styles.photo} />
          ) : (
            <Text style={styles.photoPickerText}>Add profile photo</Text>
          )}
          {uploadingPhoto && (
            <View style={styles.photoUploadingOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </WaveHeader>

      <View style={styles.form}>
      <FieldLabel icon="person" label="First name" />
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Alex" accessibilityLabel="First name" />

      <FieldLabel icon="call" label="Mobile number" />
      <View style={styles.lockedField}>
        <Text style={styles.lockedFieldText}>{profile?.phone}</Text>
      </View>
      <Text style={styles.hint}>Your mobile number is your account's permanent identity and can't be changed.</Text>

      <FieldLabel icon="calendar" label="Age" />
      <View style={styles.lockedField}>
        <Text style={styles.lockedFieldText}>{profile?.age}</Text>
      </View>
      <Text style={styles.hint}>Set when you created your account and can't be changed.</Text>

      <FieldLabel icon="male-female" label="Gender" />
      <View style={styles.lockedField}>
        <Text style={styles.lockedFieldText}>{profile?.gender}</Text>
      </View>
      <Text style={styles.hint}>Set when you created your account and can't be changed.</Text>

      <FieldLabel icon="location" label="Postcode" />
      <Text style={styles.hint}>Currently set to {profile?.locationLabel || "not set"}. Your exact address is never shown.</Text>
      <PostcodeInput
        postcode={postcode}
        onChangePostcode={setPostcode}
        onResolved={(r) => {
          setLocationLabel(r.label);
          setLocationLat(r.lat);
          setLocationLng(r.lng);
        }}
      />

      <FieldLabel icon="pencil" label="Biography" />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell other members a bit about yourself and the projects you enjoy."
        multiline
        numberOfLines={4}
      />

      <FieldLabel icon="nutrition" label="Dietary requirements" />
      <Text style={styles.hint}>Only visible to members of Tribes you belong to.</Text>
      <View style={styles.chipRow}>
        {DIETARY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, dietary.includes(option) && styles.chipSelected]}
            onPress={() => toggleDietary(option)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dietary.includes(option) }}
          >
            <Text style={[styles.chipText, dietary.includes(option) && styles.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {dietary.includes("Food Allergies") && (
        <>
          <FieldLabel icon="alert-circle" label="What are you allergic to?" />
          <TextInput
            style={styles.input}
            value={allergyDetail}
            onChangeText={setAllergyDetail}
            placeholder="e.g. peanuts, shellfish"
          />
        </>
      )}

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  form: { paddingHorizontal: spacing.lg },
  headerContent: { alignItems: "center" },
  headerDecoration: { width: 200, height: 228, opacity: 0.55 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "stretch", marginBottom: spacing.md },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", flex: 1 },
  headerSaveButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  photoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerText: { color: "#fff", fontSize: 12, textAlign: "center", paddingHorizontal: spacing.sm },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
  },
  lockedField: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
  },
  lockedFieldText: { fontSize: 15, color: colors.textMuted },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md },
});
