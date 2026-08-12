import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateTask,
  addTaskPhoto,
  archiveTask,
  createTask,
  deleteTask,
  getJobCategories,
  getTask,
  publishTask,
  removeTaskPhoto,
  updateTask,
} from "../../api/tasks";
import { uploadPhoto } from "../../api/uploads";
import PostcodeInput from "../../components/PostcodeInput";
import WaveHeader from "../../components/WaveHeader";
import AnimatedPressable from "../../components/AnimatedPressable";
import { useToast } from "../../components/Toast";
import FieldLabel from "../../components/FieldLabel";
import IllustrationCard from "../../components/IllustrationCard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../theme";
import { JOB_LENGTHS, JOB_LENGTH_LABELS, JobLength } from "../../constants/jobLength";

const HEADER_IMAGE = require("../../../assets/illustrations/processed/add-a-task-header.png");

export default function CreateEditTaskScreen({ route, navigation }: any) {
  const taskId: string | undefined = route.params?.taskId;
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: categories } = useQuery({ queryKey: ["job-categories"], queryFn: () => getJobCategories() });
  const { data: existingTask, isLoading: loadingTask } = useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => getTask(taskId!),
    enabled: Boolean(taskId),
  });

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [jobLength, setJobLength] = useState<JobLength | null>(null);
  const [locationType, setLocationType] = useState<"HOME" | "CHOOSE">("HOME");
  const [postcode, setPostcode] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(undefined);
  const [exactAddress, setExactAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Photos picked before a brand-new task exists yet - uploaded to storage
  // immediately (so they can be previewed) but only linked to the task once
  // it's actually created on Publish. Keeps "no task ever left half-created"
  // true without needing a draft row to attach them to in the meantime.
  const [pendingPhotos, setPendingPhotos] = useState<{ localUri: string; url: string }[]>([]);

  useEffect(() => {
    if (existingTask) {
      setName(existingTask.name);
      setCategoryId(existingTask.category.id);
      setDescription(existingTask.description);
      setJobLength((existingTask.jobLength as JobLength | null) ?? null);
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

  // Only still relevant for tasks created before drafts were removed from
  // the create flow - lets an old draft still be finished off normally.
  const publishMutation = useMutation({
    mutationFn: () => publishTask(taskId!),
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  // Navigates away immediately on confirm (see confirmDelete) instead of
  // waiting on the request - a failure surfaces via toast since this screen
  // is already gone by the time it could happen.
  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId!),
    onSuccess: invalidate,
    onError: () => toast.show("Couldn't delete the task - please try again."),
  });

  const removePhotoMutation = useMutation({
    mutationFn: (photoId: string) => removeTaskPhoto(taskId!, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", taskId] }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveTask(taskId!),
    onSuccess: invalidate,
    onError: () => toast.show("Couldn't archive the task - please try again."),
  });

  const activateMutation = useMutation({
    mutationFn: () => activateTask(taskId!),
    onSuccess: invalidate,
    onError: () => toast.show("Couldn't activate the task - please try again."),
  });

  const MAX_PHOTOS = 4;
  const photoCount = taskId ? existingTask?.photos.length ?? 0 : pendingPhotos.length;

  const pickAndUploadPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to add photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const { url } = await uploadPhoto(result.assets[0].uri);
      if (taskId) {
        await addTaskPhoto(taskId, url);
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      } else {
        setPendingPhotos((prev) => [...prev, { localUri: result.assets[0].uri, url }]);
      }
    } catch (e: any) {
      setError(e.message ?? "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const buildInput = () => {
    if (!name.trim()) return setError("Give the task a name."), null;
    if (!categoryId) return setError("Choose a job category."), null;
    if (!description.trim()) return setError("Add a short description."), null;
    if (!jobLength) return setError("Choose how long this job will take."), null;
    if (locationType === "CHOOSE" && !locationLabel.trim()) return setError("Enter a location."), null;
    if (photoCount < 1) return setError("Add at least one photo."), null;

    setError(null);
    return {
      name: name.trim(),
      categoryId,
      description: description.trim(),
      jobLength,
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

  const [publishing, setPublishing] = useState(false);

  const onPublish = async () => {
    const input = buildInput();
    if (!input) return;
    setPublishing(true);
    try {
      if (!taskId) {
        const created = await createMutation.mutateAsync(input);
        for (const photo of pendingPhotos) {
          await addTaskPhoto(created.id, photo.url);
        }
        invalidate();
        navigation.goBack();
        return;
      }

      await updateMutation.mutateAsync(input);
      if (existingTask?.status === "DRAFT") {
        await publishMutation.mutateAsync();
      }
    } catch {
      // Errors are already surfaced via each mutation's onError -> setError.
    } finally {
      setPublishing(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete task", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          navigation.goBack();
          deleteMutation.mutate();
        },
      },
    ]);
  };

  const confirmArchive = () => {
    Alert.alert(
      "Archive this task?",
      "It'll be shelved out of your active tasks and won't count toward your task limit. You can activate it again any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => {
            navigation.goBack();
            archiveMutation.mutate();
          },
        },
      ]
    );
  };

  const isArchived = existingTask?.status === "USER_ARCHIVED";
  const isAvailable = existingTask?.status === "AVAILABLE";

  const busy =
    publishing || deleteMutation.isPending || uploadingPhoto || archiveMutation.isPending || activateMutation.isPending;

  if (taskId && loadingTask) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
      <WaveHeader illustration={<IllustrationCard source={HEADER_IMAGE} width={155} aspectRatio={1311 / 735} />}>
        <View style={styles.topRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </AnimatedPressable>
        </View>
        <Text style={styles.headerTitle}>{taskId ? "Edit Task" : "Add a Task"}</Text>
        <Text style={styles.headerSubtitle}>Create a task you need help with and offer it in exchange.</Text>
      </WaveHeader>

      <View style={styles.form}>
      {isArchived && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedBannerText}>
            This task is archived. Activate it to make it available and edit it again.
          </Text>
        </View>
      )}

      <View pointerEvents={isArchived ? "none" : "auto"} style={isArchived && styles.readOnlyForm}>
      <FieldLabel icon="pencil" label="Task name" required />
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Repaint the fence" />

      <FieldLabel icon="grid" label="Job category" required />
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

      <FieldLabel icon="list" label="Description" required />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="What needs doing? Be specific so helpers know what to expect."
        multiline
        numberOfLines={4}
      />

      <FieldLabel icon="time" label="Estimate job length" required />
      <Text style={styles.hint}>Tribr doesn't support tasks that take longer than 1 day.</Text>
      <View style={styles.chipRow}>
        {JOB_LENGTHS.map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.chip, jobLength === l && styles.chipSelected]}
            onPress={() => setJobLength(l)}
          >
            <Text style={[styles.chipText, jobLength === l && styles.chipTextSelected]}>{JOB_LENGTH_LABELS[l]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FieldLabel icon="location" label="Location" required />
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
          <FieldLabel icon="navigate" label="Location" />
          <PostcodeInput
            postcode={postcode}
            onChangePostcode={setPostcode}
            onResolved={(r) => {
              setLocationLabel(r.label);
              setLocationLat(r.lat);
              setLocationLng(r.lng);
            }}
          />
          <FieldLabel icon="home" label="Exact address (optional, private)" />
          <TextInput
            style={styles.input}
            value={exactAddress}
            onChangeText={setExactAddress}
            placeholder="12 Example Street, Bristol, BS1 1AA"
          />
        </>
      )}
      <Text style={styles.hint}>Your exact address is only shared with the Tribe once a work date is confirmed.</Text>

      <FieldLabel icon="clipboard" label="Notes (optional)" />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else helpers should know"
        multiline
      />

      <FieldLabel icon="camera" label={`Photos (${photoCount}/${MAX_PHOTOS}) - at least 1 required`} />
      <Text style={styles.hint}>Long-press a photo to remove it.</Text>
      <View style={styles.photoRow}>
        {taskId
          ? existingTask?.photos.map((p) => (
              <TouchableOpacity key={p.id} onLongPress={() => removePhotoMutation.mutate(p.id)}>
                <Image source={{ uri: p.url }} style={styles.photo} />
              </TouchableOpacity>
            ))
          : pendingPhotos.map((p, i) => (
              <TouchableOpacity
                key={p.url}
                onLongPress={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Image source={{ uri: p.localUri }} style={styles.photo} />
              </TouchableOpacity>
            ))}
        {photoCount < MAX_PHOTOS && (
          <TouchableOpacity style={styles.photoAdd} onPress={pickAndUploadPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.photoAddText}>+ Add</Text>}
          </TouchableOpacity>
        )}
      </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {isArchived ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            navigation.goBack();
            activateMutation.mutate();
          }}
          disabled={busy}
        >
          <Text style={styles.primaryButtonText}>Activate task</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.actions}>
          {!taskId && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()} disabled={busy}>
              <Text style={styles.secondaryButtonText}>Discard</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={onPublish} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{taskId ? "Save changes" : "Publish task"}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {taskId && isAvailable && (
        <TouchableOpacity style={styles.archiveButton} onPress={confirmArchive} disabled={busy}>
          <Text style={styles.archiveButtonText}>Archive task</Text>
        </TouchableOpacity>
      )}

      {taskId && !existingTask?.groupId && (
        <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={busy}>
          <Text style={styles.deleteButtonText}>Delete task</Text>
        </TouchableOpacity>
      )}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  form: { paddingHorizontal: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "800", maxWidth: "60%" },
  headerSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4, maxWidth: "60%", lineHeight: 18 },
  headerIllustration: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    margin: 18,
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
  archiveButton: {
    marginTop: spacing.md,
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 10,
  },
  archiveButtonText: { color: colors.textMuted, fontWeight: "600" },
  archivedBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  archivedBannerText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  readOnlyForm: { opacity: 0.55 },
});
