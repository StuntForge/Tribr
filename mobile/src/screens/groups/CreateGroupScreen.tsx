import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroup } from "../../api/groups";
import { getJobCategories, getMyTasks } from "../../api/tasks";
import TaskSelectRow from "../../components/TaskSelectRow";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import AnimatedPressable from "../../components/AnimatedPressable";
import FieldLabel from "../../components/FieldLabel";
import IllustrationCard from "../../components/IllustrationCard";
import PostcodeInput, { ResolvedLocation } from "../../components/PostcodeInput";
import SegmentedTabs from "../../components/SegmentedTabs";
import { calendarTheme, formatDateLabel, formatTime12h, TIME_OPTIONS, toDateString } from "../../components/CalendarPicker";
import { colors, radii, spacing } from "../../theme";
import { JOB_LENGTHS, JOB_LENGTH_LABELS, JOB_LENGTH_RANK, JobLength } from "../../constants/jobLength";

const HEADER_IMAGE = require("../../../assets/illustrations/processed/create-group-header.png");

const SIZE_MIN = 3;
const SIZE_MAX = 6;
const SIZE_OPTIONS = Array.from({ length: SIZE_MAX - SIZE_MIN + 1 }, (_, i) => SIZE_MIN + i);

const RATING_OPTIONS: (number | null)[] = [null, 2, 3, 4];
const GENDER_OPTIONS: (string | null)[] = [null, "Male", "Female"];
const AGE_OPTIONS: (number | null)[] = [null, ...Array.from({ length: 99 - 18 + 1 }, (_, i) => 18 + i)];

type TribeType = "WORK" | "SOCIAL";
type DateType = "FIXED" | "SCHEDULE_TOGETHER";

const TRIBE_TYPE_OPTIONS = [
  { value: "WORK" as TribeType, label: "Work Tribe", icon: "hammer" as const },
  { value: "SOCIAL" as TribeType, label: "Social Tribe", icon: "people" as const },
];

export default function CreateGroupScreen({ route, navigation }: any) {
  const blocked = Boolean(route.params?.blocked);
  const queryClient = useQueryClient();

  const [tribeType, setTribeType] = useState<TribeType>("WORK");

  const { data: categories } = useQuery({
    queryKey: ["job-categories", "WORK"],
    queryFn: () => getJobCategories("WORK"),
    enabled: !blocked,
  });
  const { data: socialCategories } = useQuery({
    queryKey: ["job-categories", "SOCIAL"],
    queryFn: () => getJobCategories("SOCIAL"),
    enabled: !blocked,
  });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks, enabled: !blocked });

  // Shared fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sizeMin, setSizeMin] = useState(SIZE_MIN);
  const [sizeMax, setSizeMax] = useState(SIZE_MAX);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [preferredGender, setPreferredGender] = useState<string | null>(null);
  const [ageMin, setAgeMin] = useState<number | null>(null);
  const [ageMax, setAgeMax] = useState<number | null>(null);
  const [maxJobLength, setMaxJobLength] = useState<JobLength | null>(null);

  // Work-only fields
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  // Social-only fields
  const [socialCategoryId, setSocialCategoryId] = useState<string | null>(null);
  const [postcode, setPostcode] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [dateType, setDateType] = useState<DateType | null>(null);
  const [fixedDateString, setFixedDateString] = useState<string | null>(null);
  const [fixedTime, setFixedTime] = useState("18:00");

  const [error, setError] = useState<string | null>(null);

  const switchTribeType = (next: TribeType) => {
    setTribeType(next);
    setError(null);
  };

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    setTaskId(null);
  };

  const onLocationResolved = (result: ResolvedLocation) => {
    setLocationLabel(result.label);
    setLocationLat(result.lat);
    setLocationLng(result.lng);
  };

  const availableTasks = (tasks ?? []).filter(
    (t) =>
      t.status === "AVAILABLE" &&
      categoryIds.includes(t.category.id) &&
      (!maxJobLength || !t.jobLength || JOB_LENGTH_RANK[t.jobLength as JobLength] <= JOB_LENGTH_RANK[maxJobLength])
  );

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      navigation.replace("GroupDetail", { groupId: group.id });
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const Header = (
    <WaveHeader illustration={<IllustrationCard source={HEADER_IMAGE} width={170} aspectRatio={1252 / 789} />}>
      <View style={styles.topRow}>
        <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </AnimatedPressable>
        <View style={styles.logoCenter} pointerEvents="none">
          <TribrLogo />
        </View>
      </View>
      <Text style={styles.title}>Form a Tribe</Text>
      <Text style={styles.subtitle}>Set up your Tribe and invite others to get things done - or just get together.</Text>
    </WaveHeader>
  );

  if (blocked) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.center}>
          <Text style={styles.blockedTitle}>Subscribers only</Text>
          <Text style={styles.blockedBody}>
            Forming a Tribe is a Subscriber feature. Free members can still browse and apply to Tribes.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Profile", { screen: "Subscription" })}
          >
            <Text style={styles.primaryButtonText}>View subscription options</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const onSubmit = () => {
    if (!name.trim()) return setError("Give the Tribe a name.");
    if (!description.trim()) return setError("Add a short description.");
    if (sizeMin > sizeMax) return setError("Minimum Tribe size can't be greater than the maximum.");
    if (ageMin != null && ageMax != null && ageMin > ageMax) {
      return setError("Minimum age can't be greater than the maximum.");
    }

    if (tribeType === "SOCIAL") {
      if (!socialCategoryId) return setError("Choose a category for this Tribe.");
      if (!locationLabel || locationLat == null || locationLng == null) return setError("Add a location for this Tribe.");
      if (!dateType) return setError("Choose Fixed Date or Schedule Together.");
      if (dateType === "FIXED" && !fixedDateString) return setError("Pick a date for this Tribe.");

      setError(null);
      mutation.mutate({
        tribeType: "SOCIAL",
        name: name.trim(),
        description: description.trim(),
        sizeMin,
        sizeMax,
        verifiedOnly,
        minRating: minRating ?? undefined,
        preferredGender: preferredGender ?? undefined,
        preferredAgeMin: ageMin ?? undefined,
        preferredAgeMax: ageMax ?? undefined,
        durationBand: maxJobLength ?? undefined,
        socialCategoryId,
        locationLabel,
        locationLat: locationLat!,
        locationLng: locationLng!,
        dateType,
        fixedDate: dateType === "FIXED" ? new Date(`${fixedDateString}T${fixedTime}:00`).toISOString() : undefined,
        fixedAllDay: dateType === "FIXED" ? false : undefined,
        fixedStartTime: dateType === "FIXED" ? fixedTime : undefined,
      });
      return;
    }

    if (categoryIds.length === 0) return setError("Choose at least one allowed category.");
    if (!taskId) return setError("Choose one of your available tasks to represent you.");
    setError(null);
    mutation.mutate({
      tribeType: "WORK",
      name: name.trim(),
      description: description.trim(),
      categoryIds,
      sizeMin,
      sizeMax,
      taskId,
      verifiedOnly,
      minRating: minRating ?? undefined,
      preferredGender: preferredGender ?? undefined,
      preferredAgeMin: ageMin ?? undefined,
      preferredAgeMax: ageMax ?? undefined,
      durationBand: maxJobLength ?? undefined,
    });
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
      {Header}
      <View style={styles.form}>
        <View style={styles.typeSelector}>
          <SegmentedTabs options={TRIBE_TYPE_OPTIONS} value={tribeType} onChange={switchTribeType} />
        </View>

        <FieldLabel icon="people" label="Tribe name" />
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Bristol Garden Crew" />

        <FieldLabel icon="reader" label="Description" />
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder={tribeType === "WORK" ? "What kind of projects is this Tribe for?" : "What's this Tribe about?"}
          multiline
        />

        {tribeType === "WORK" ? (
          <>
            <FieldLabel icon="pricetag" label="Allowed categories" />
            <Text style={styles.hint}>Members can only join (or be invited) with a task in one of these categories.</Text>
            <View style={styles.chipRow}>
              {categories?.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, categoryIds.includes(c.id) && styles.chipSelected]}
                  onPress={() => toggleCategory(c.id)}
                >
                  <Text style={[styles.chipText, categoryIds.includes(c.id) && styles.chipTextSelected]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <FieldLabel icon="pricetag" label="Category" />
            <View style={styles.chipRow}>
              {socialCategories?.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, socialCategoryId === c.id && styles.chipSelected]}
                  onPress={() => setSocialCategoryId(c.id)}
                >
                  <Text style={[styles.chipText, socialCategoryId === c.id && styles.chipTextSelected]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel icon="location" label="Location" />
            <Text style={styles.hint}>Where this Tribe's activity happens. Your exact address is never shown.</Text>
            <PostcodeInput postcode={postcode} onChangePostcode={setPostcode} onResolved={onLocationResolved} />
          </>
        )}

        <FieldLabel icon="people-circle" label="Tribe size" />
        <Text style={styles.hint}>Minimum {SIZE_MIN}, maximum {SIZE_MAX} members.</Text>
        <View style={styles.ageRow}>
          <NumberSelect label="Minimum" options={SIZE_OPTIONS} value={sizeMin} onChange={setSizeMin} />
          <Text style={styles.ageSeparator}>–</Text>
          <NumberSelect label="Maximum" options={SIZE_OPTIONS} value={sizeMax} onChange={setSizeMax} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <FieldLabel icon="shield-checkmark" label="Verified members only" />
            <Text style={styles.hint}>Only members who've completed at least one cycle before can apply.</Text>
          </View>
          <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{ true: colors.primary }} />
        </View>

        <FieldLabel icon="star" label="Minimum rating to apply" />
        <View style={styles.chipRow}>
          {RATING_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r ?? "any"}
              style={[styles.chip, minRating === r && styles.chipSelected]}
              onPress={() => setMinRating(r)}
            >
              <Text style={[styles.chipText, minRating === r && styles.chipTextSelected]}>{r == null ? "Any" : `${r.toFixed(1)}★`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel icon="male-female" label="Preferred gender" />
        <Text style={styles.hint}>Only people matching this will see or be able to join this Tribe.</Text>
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map((g) => (
            <TouchableOpacity
              key={g ?? "any"}
              style={[styles.chip, preferredGender === g && styles.chipSelected]}
              onPress={() => setPreferredGender(g)}
            >
              <Text style={[styles.chipText, preferredGender === g && styles.chipTextSelected]}>{g ?? "Any"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel icon="person" label="Preferred age range" />
        <Text style={styles.hint}>Only people within this range will see or be able to join this Tribe.</Text>
        <View style={styles.ageRow}>
          <AgeSelect label="Min age" value={ageMin} onChange={setAgeMin} />
          <Text style={styles.ageSeparator}>–</Text>
          <AgeSelect label="Max age" value={ageMax} onChange={setAgeMax} />
        </View>

        <FieldLabel icon="time" label={tribeType === "WORK" ? "Maximum job length" : "Estimated length"} />
        <Text style={styles.hint}>
          {tribeType === "WORK" ? "Members can only join with a task up to this length." : "Roughly how long this activity lasts."}
        </Text>
        <View style={styles.chipRow}>
          {(["Any", ...JOB_LENGTHS] as const).map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.chip, (l === "Any" ? maxJobLength == null : maxJobLength === l) && styles.chipSelected]}
              onPress={() => {
                setMaxJobLength(l === "Any" ? null : l);
                setTaskId(null);
              }}
            >
              <Text style={[styles.chipText, (l === "Any" ? maxJobLength == null : maxJobLength === l) && styles.chipTextSelected]}>
                {l === "Any" ? "Any" : JOB_LENGTH_LABELS[l]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tribeType === "WORK" ? (
          <>
            <FieldLabel icon="clipboard" label="Your task for this Tribe" />
            {categoryIds.length === 0 ? (
              <Text style={styles.hint}>Choose at least one allowed category first.</Text>
            ) : availableTasks.length === 0 ? (
              <Text style={styles.hint}>
                You don't have an available task in an allowed category. Add one from your Task Library first.
              </Text>
            ) : (
              <View>
                {availableTasks.map((t) => (
                  <TaskSelectRow key={t.id} task={t} selected={taskId === t.id} onSelect={() => setTaskId(t.id)} navigation={navigation} />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <FieldLabel icon="calendar" label="Date" />
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, dateType === "FIXED" && styles.chipSelected]}
                onPress={() => setDateType("FIXED")}
              >
                <Text style={[styles.chipText, dateType === "FIXED" && styles.chipTextSelected]}>Fixed date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, dateType === "SCHEDULE_TOGETHER" && styles.chipSelected]}
                onPress={() => setDateType("SCHEDULE_TOGETHER")}
              >
                <Text style={[styles.chipText, dateType === "SCHEDULE_TOGETHER" && styles.chipTextSelected]}>Schedule together</Text>
              </TouchableOpacity>
            </View>
            {dateType === "SCHEDULE_TOGETHER" && (
              <Text style={styles.hint}>Once the Tribe starts, you'll propose dates and members will submit their availability.</Text>
            )}
            {dateType === "FIXED" && (
              <FixedDateTimePicker
                dateString={fixedDateString}
                time={fixedTime}
                onChangeDate={setFixedDateString}
                onChangeTime={setFixedTime}
              />
            )}
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Form Tribe</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

function NumberSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.ageSelectButton} onPress={() => setOpen(true)}>
        <Text style={styles.ageSelectText}>
          {label}: {value}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(n) => String(n)}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, item === value && styles.pickerRowTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function AgeSelect({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.ageSelectButton} onPress={() => setOpen(true)}>
        <Text style={styles.ageSelectText}>
          {label}: {value ?? "Any"}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>{label}</Text>
            <FlatList
              data={AGE_OPTIONS}
              keyExtractor={(n) => String(n)}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, item === value && styles.pickerRowTextSelected]}>{item ?? "Any"}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// A single date + time pick for a Fixed Date Social Tribe - distinct from
// CalendarPicker (components/CalendarPicker.tsx), which proposes several
// possible dates for others to respond to. Here there's only ever one date,
// chosen once by the creator.
function FixedDateTimePicker({
  dateString,
  time,
  onChangeDate,
  onChangeTime,
}: {
  dateString: string | null;
  time: string;
  onChangeDate: (v: string) => void;
  onChangeTime: (v: string) => void;
}) {
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const markedDates: Record<string, any> = {};
  if (dateString) markedDates[dateString] = { selected: true, selectedColor: colors.primary };

  return (
    <View>
      <Calendar
        minDate={toDateString(new Date())}
        markedDates={markedDates}
        onDayPress={(day: { dateString: string }) => {
          onChangeDate(day.dateString);
          setTimePickerOpen(true);
        }}
        theme={calendarTheme}
        style={styles.calendar}
      />
      {dateString && (
        <TouchableOpacity style={styles.timeButton} onPress={() => setTimePickerOpen(true)}>
          <Text style={styles.timeButtonText}>
            {formatDateLabel(dateString)} · {formatTime12h(time)}
          </Text>
        </TouchableOpacity>
      )}
      <Modal visible={timePickerOpen} transparent animationType="fade" onRequestClose={() => setTimePickerOpen(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setTimePickerOpen(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Start time</Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(t) => t}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    onChangeTime(item);
                    setTimePickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, item === time && styles.pickerRowTextSelected]}>{formatTime12h(item)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  logoCenter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", maxWidth: "58%" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4, lineHeight: 18, maxWidth: "58%" },
  headerIllustration: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    margin: 18,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  blockedTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  blockedBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  content: { paddingBottom: spacing.xl },
  form: { paddingHorizontal: spacing.lg },
  typeSelector: { marginBottom: spacing.md },
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
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ageRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ageSeparator: { color: colors.textMuted },
  ageSelectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  ageSelectText: { fontSize: 14, color: colors.text },
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  timeButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
  },
  timeButtonText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: "60%" },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  pickerList: { maxHeight: 320 },
  pickerRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowText: { fontSize: 15, color: colors.text },
  pickerRowTextSelected: { color: colors.primary, fontWeight: "700" },
  error: { color: colors.danger, marginTop: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
