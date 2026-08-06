import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTaskPhoto,
  createTask,
  deleteTask,
  getJobCategories,
  getTask,
  publishTask,
  removeTaskPhoto,
  updateTask,
} from "../../api/tasks";
import { uploadPhoto } from "../../api/uploads";
import { colors, spacing } from "../../theme";

export default function CreateEditTaskScreen({ route, navigation }: any) {
  const taskId: string | undefined = route.params?.taskId;
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: getJobCategories });
  const { data: existingTask, isLoading: loadingTask } = useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => getTask(taskId!),
    enabled: Boolean(taskId),
  });

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [locationType, setLocationType] = useState<"HOME" | "CHOOSE">("HOME");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(undefined);
  const [exactAddress, setExactAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (existingTask) {
      setName(existingTask.name);
      setCategoryId(existingTask.category.id);
      setDescription(existingTask.description);
      setHours(String(existingTask.estimatedManHours));
      setLocationType(existingTask.locationType);
      setLocationLabel(existingTask.locationType === "CHOOSE" ? existingTask.locationLabel ?? "" : "");
      setLocationLat(existingTask.locationLat ?? undefined);
      setLocationLng(existingTask.locationLng ?? undefined);
      setExactAddress(existingTask.locationType === "CHOOSE" ? existingTask.exactAddress ?? "" : "");
      setNotes(existingTask.notes ?? "");
    }
  }, [existingTask]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      invalidate();
      navigation.replace("CreateEditTask", { taskId: task.id });
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(taskId!, input),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      navigation.goBack();
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishTask(taskId!),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId!),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const addPhotoMutation = useMutation({
    mutationFn: (url: string) => addTaskPhoto(taskId!, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", taskId] }),
  });

  const removePhotoMutation = useMutation({
    mutationFn: (photoId: string) => removeTaskPhoto(taskId!, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", taskId] }),
  });

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Location access is needed to set a task location.");
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
      if (place) setLocationLabel([place.city, place.region].filter(Boolean).join(", "));
    } catch {
      setError("Could not determine your location. Type it manually instead.");
    } finally {
      setLocating(false);
    }
  };

  const pickAndUploadPhoto = async () => {
    if (!taskId) {
      setError("Save the task first, then you can add photos.");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to add photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const { url } = await uploadPhoto(result.assets[0].uri);
        addPhotoMutation.mutate(url);
      } catch (e: any) {
        setError(e.message ?? "Could not upload photo.");
      }
    }
  };

  const buildInput = () => {
    const hoursNum = Number(hours);
    if (!name.trim()) return setError("Give the task a name."), null;
    if (!categoryId) return setError("Choose a job category."), null;
    if (!description.trim()) return setError("Add a short description."), null;
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) return setError("Enter estimated man hours."), null;
    if (locationType === "CHOOSE" && !locationLabel.trim()) return setError("Enter a location."), null;

    setError(null);
    return {
      name: name.trim(),
      categoryId,
      description: description.trim(),
      estimatedManHours: hoursNum,
      location:
        locationType === "HOME"
          ? ({ type: "HOME" } as const)
          : ({
              type: "CHOOSE" as const,
              label: locationLabel.trim(),
              lat: locationLat,
              lng: locationLng,
              exactAddress: exactAddress.trim() || undefined,
            }),
      notes: notes.trim() || undefined,
    };
  };

  const onSaveDraft = () => {
    const input = buildInput();
    if (!input) return;
    if (taskId) updateMutation.mutate(input);
    else createMutation.mutate({ ...input, isDraft: true });
  };

  const onPublish = () => {
    const input = buildInput();
    if (!input) return;
    if (taskId && existingTask?.status !== "DRAFT") {
      updateMutation.mutate(input);
    } else if (taskId) {
      updateMutation.mutate(input, { onSuccess: () => publishMutation.mutate() });
    } else {
      createMutation.mutate(input);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete task", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  const busy =
    createMutation.isPending || updateMutation.isPending || publishMutation.isPending || deleteMutation.isPending;

  if (taskId && loadingTask) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Task name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Repaint the fence" />

      <Text style={styles.label}>Job category</Text>
      <View style={styles.chipRow}>
        {categories?.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipSelected]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextSelected]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="What needs doing? Be specific so helpers know what to expect."
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Estimated man hours</Text>
      <Text style={styles.hint}>
        One man hour = one person working for one hour. E.g. a fence that takes 2 people 3 hours each is 6 man
        hours.
      </Text>
      <TextInput style={styles.input} value={hours} onChangeText={setHours} placeholder="6" keyboardType="numeric" />

      <Text style={styles.label}>Location</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, locationType === "HOME" && styles.chipSelected]}
          onPress={() => setLocationType("HOME")}
        >
          <Text style={[styles.chipText, locationType === "HOME" && styles.chipTextSelected]}>My home address</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, locationType === "CHOOSE" && styles.chipSelected]}
          onPress={() => setLocationType("CHOOSE")}
        >
          <Text style={[styles.chipText, locationType === "CHOOSE" && styles.chipTextSelected]}>Choose location</Text>
        </TouchableOpacity>
      </View>
      {locationType === "CHOOSE" && (
        <>
          <TextInput
            style={styles.input}
            value={locationLabel}
            onChangeText={setLocationLabel}
            placeholder="Bristol, UK"
          />
          <TouchableOpacity onPress={useCurrentLocation} style={styles.linkButton}>
            {locating ? <ActivityIndicator /> : <Text style={styles.linkButtonText}>Use my current location</Text>}
          </TouchableOpacity>
          <Text style={styles.label}>Exact address (optional, private)</Text>
          <TextInput
            style={styles.input}
            value={exactAddress}
            onChangeText={setExactAddress}
            placeholder="12 Example Street, Bristol, BS1 1AA"
          />
        </>
      )}
      <Text style={styles.hint}>Your exact address is only shared with the group once a work date is confirmed.</Text>

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else helpers should know"
        multiline
      />

      <Text style={styles.label}>Photos</Text>
      <View style={styles.photoRow}>
        {existingTask?.photos.map((p) => (
          <TouchableOpacity key={p.id} onLongPress={() => removePhotoMutation.mutate(p.id)}>
            <Image source={{ uri: p.url }} style={styles.photo} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.photoAdd} onPress={pickAndUploadPhoto}>
          <Text style={styles.photoAddText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {!taskId && <Text style={styles.hint}>Save the task first, then you can add photos.</Text>}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onSaveDraft} disabled={busy}>
          <Text style={styles.secondaryButtonText}>Save as draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onPublish} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Publish task</Text>}
        </TouchableOpacity>
      </View>

      {taskId && !existingTask?.groupId && (
        <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={busy}>
          <Text style={styles.deleteButtonText}>Delete task</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
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
  multiline: { minHeight: 80, textAlignVertical: "top" },
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
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 72, height: 72, borderRadius: 8 },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.primary, fontWeight: "600" },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  deleteButton: { marginTop: spacing.lg, alignItems: "center", padding: spacing.md },
  deleteButtonText: { color: colors.danger, fontWeight: "600" },
});
