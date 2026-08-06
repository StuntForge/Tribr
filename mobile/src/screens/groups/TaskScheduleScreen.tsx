import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Calendar from "expo-calendar";
import {
  confirmWorkDay,
  DateOptionInfo,
  getSchedule,
  ProposeDateOption,
  proposeDates,
  respondAvailability,
  ScheduleInfo,
} from "../../api/schedule";
import { colors, spacing } from "../../theme";

export default function TaskScheduleScreen({ route }: any) {
  const { groupId, taskId, taskName } = route.params as { groupId: string; taskId: string; taskName: string };
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["schedule", groupId, taskId],
    queryFn: () => getSchedule(groupId, taskId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schedule", groupId, taskId] });

  const respondMutation = useMutation({
    mutationFn: ({ dateOptionId, available }: { dateOptionId: string; available: boolean }) =>
      respondAvailability(groupId, taskId, dateOptionId, available),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ dateOptionId, foodProvided }: { dateOptionId: string; foodProvided: boolean }) =>
      confirmWorkDay(groupId, taskId, dateOptionId, foodProvided),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const proposeMutation = useMutation({
    mutationFn: (options: ProposeDateOption[]) => proposeDates(groupId, taskId, options),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  if (isLoading || !schedule) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{taskName}</Text>

      {schedule.workDay ? (
        <ConfirmedView workDay={schedule.workDay} taskName={taskName} />
      ) : (
        <>
          {schedule.proposal && (
            <DateOptionsList
              options={schedule.proposal.options}
              isOwner={schedule.isOwner}
              onRespond={(id, available) => respondMutation.mutate({ dateOptionId: id, available })}
              onConfirm={(id, food) => confirmMutation.mutate({ dateOptionId: id, foodProvided: food })}
            />
          )}
          {schedule.isOwner && (
            <ProposeForm busy={proposeMutation.isPending} onSubmit={(options) => proposeMutation.mutate(options)} />
          )}
          {!schedule.isOwner && !schedule.proposal && (
            <Text style={styles.hint}>Waiting for the task owner to propose some dates.</Text>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

function ConfirmedView({
  workDay,
  taskName,
}: {
  workDay: NonNullable<ScheduleInfo["workDay"]>;
  taskName: string;
}) {
  const dateLabel = workDay.allDay
    ? new Date(workDay.confirmedDate).toDateString()
    : `${new Date(workDay.confirmedDate).toDateString()} ${workDay.startTime}–${workDay.endTime}`;

  const addToCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") return;
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find((c) => c.allowsModifications) ?? calendars[0];
      if (!defaultCalendar) return;

      const start = new Date(workDay!.confirmedDate);
      const end = workDay!.allDay ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

      await Calendar.createEventAsync(defaultCalendar.id, {
        title: taskName,
        startDate: start,
        endDate: end,
        allDay: workDay!.allDay,
        location: workDay!.address ?? undefined,
      });
      Alert.alert("Added to calendar");
    } catch {
      Alert.alert("Couldn't add to calendar", "You can add it manually instead.");
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Work day confirmed</Text>
      <Text style={styles.confirmedDate}>{dateLabel}</Text>
      <Text style={styles.hint}>{workDay!.foodProvided ? "Snacks provided" : "No food provided — bring your own"}</Text>
      {workDay!.address ? (
        <Text style={styles.address}>{workDay!.address}</Text>
      ) : (
        <Text style={styles.hint}>No exact address was set for this task.</Text>
      )}
      <TouchableOpacity style={styles.secondaryButton} onPress={addToCalendar}>
        <Text style={styles.secondaryButtonText}>Add to calendar</Text>
      </TouchableOpacity>
    </View>
  );
}

function DateOptionsList({
  options,
  isOwner,
  onRespond,
  onConfirm,
}: {
  options: DateOptionInfo[];
  isOwner: boolean;
  onRespond: (id: string, available: boolean) => void;
  onConfirm: (id: string, foodProvided: boolean) => void;
}) {
  const [foodByOption, setFoodByOption] = useState<Record<string, boolean>>({});

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Proposed dates</Text>
      {options.map((option) => {
        const label = option.allDay
          ? new Date(option.date).toDateString()
          : `${new Date(option.date).toDateString()} ${option.startTime}–${option.endTime}`;
        return (
          <View key={option.id} style={styles.optionCard}>
            <Text style={styles.optionDate}>{label}</Text>
            <Text style={styles.hint}>
              {option.availableCount} available · {option.unavailableCount} unavailable
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.chip, option.myResponse === true && styles.chipSelected]}
                onPress={() => onRespond(option.id, true)}
              >
                <Text style={[styles.chipText, option.myResponse === true && styles.chipTextSelected]}>I'm available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, option.myResponse === false && styles.chipSelected]}
                onPress={() => onRespond(option.id, false)}
              >
                <Text style={[styles.chipText, option.myResponse === false && styles.chipTextSelected]}>Can't make it</Text>
              </TouchableOpacity>
            </View>

            {isOwner && (
              <View style={styles.ownerBox}>
                {option.dietary && option.dietary.length > 0 && (
                  <Text style={styles.hint}>Dietary needs of available members: {option.dietary.join(", ")}</Text>
                )}
                <View style={styles.foodRow}>
                  <Text style={styles.hint}>Provide snacks?</Text>
                  <Switch
                    value={Boolean(foodByOption[option.id])}
                    onValueChange={(v) => setFoodByOption((prev) => ({ ...prev, [option.id]: v }))}
                  />
                </View>
                <TouchableOpacity
                  style={styles.primaryButtonSmall}
                  onPress={() => onConfirm(option.id, Boolean(foodByOption[option.id]))}
                >
                  <Text style={styles.primaryButtonText}>Confirm this date</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function ProposeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (options: ProposeDateOption[]) => void }) {
  const [dates, setDates] = useState<Date[]>([new Date(Date.now() + 24 * 60 * 60 * 1000)]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const addSlot = () => setDates((prev) => [...prev, new Date(Date.now() + 48 * 60 * 60 * 1000)]);
  const removeSlot = (i: number) => setDates((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Propose work dates</Text>
      <Text style={styles.hint}>Add a few options to maximise attendance.</Text>
      {dates.map((date, i) => (
        <View key={i} style={styles.dateRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setPickerIndex(i)}>
            <Text style={styles.dateButtonText}>{date.toDateString()}</Text>
          </TouchableOpacity>
          {dates.length > 1 && (
            <TouchableOpacity onPress={() => removeSlot(i)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {pickerIndex !== null && (
        <DateTimePicker
          value={dates[pickerIndex]}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            if (selected) {
              setDates((prev) => prev.map((d, idx) => (idx === pickerIndex ? selected : d)));
            }
            setPickerIndex(null);
          }}
        />
      )}
      <TouchableOpacity onPress={addSlot} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>+ Add another option</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.primaryButtonSmall}
        disabled={busy}
        onPress={() => onSubmit(dates.map((d) => ({ date: d.toISOString(), allDay: true })))}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Propose these dates</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  confirmedDate: { fontSize: 16, fontWeight: "600", color: colors.primary, marginTop: spacing.xs },
  address: { fontSize: 14, color: colors.text, marginTop: spacing.sm, fontWeight: "600" },
  optionCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  optionDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  ownerBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  foodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: spacing.sm },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  dateButton: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm },
  dateButtonText: { color: colors.text, fontSize: 14 },
  removeText: { color: colors.danger, fontSize: 16, paddingHorizontal: spacing.sm },
  linkButton: { marginBottom: spacing.md },
  linkButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md },
  primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginTop: spacing.md },
  secondaryButtonText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
});
