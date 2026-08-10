import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ExpoCalendar from "expo-calendar";
import {
  confirmWorkDay,
  DateOptionInfo,
  getSchedule,
  ProposeDateOption,
  proposeDates,
  respondAvailability,
  reviseDates,
  ScheduleInfo,
  submitAvailability,
} from "../../api/schedule";
import { colors, radii, spacing } from "../../theme";

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Calendar cells give us plain "YYYY-MM-DD" strings - build the Date at
// local noon so a UTC round-trip (toISOString) can never drift it a day.
function dateStringToISO(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function formatDateLabel(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTime12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

const TIME_OPTIONS: string[] = (() => {
  const times: string[] = [];
  for (let h = 7; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30) continue;
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
})();

const calendarTheme = {
  todayTextColor: colors.primary,
  selectedDayBackgroundColor: colors.primary,
  arrowColor: colors.primary,
  monthTextColor: colors.text,
  textSectionTitleColor: colors.textMuted,
  dayTextColor: colors.text,
  textDisabledColor: colors.border,
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
};

export default function TaskScheduleScreen({ route }: any) {
  const { groupId, taskId, taskName } = route.params as { groupId: string; taskId: string; taskName: string };
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["schedule", groupId, taskId],
    queryFn: () => getSchedule(groupId, taskId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schedule", groupId, taskId] });

  // Only the dates marked available get posted - anything left off is
  // treated as unavailable automatically once submitted (see the submit
  // endpoint). That means tapping a date is a purely local, instant toggle
  // with zero network calls; the only round trips happen once, on Submit.
  const submitMutation = useMutation({
    mutationFn: async (availableDateOptionIds: string[]) => {
      await Promise.all(availableDateOptionIds.map((id) => respondAvailability(groupId, taskId, id, true)));
      await submitAvailability(groupId, taskId);
    },
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

  const reviseMutation = useMutation({
    mutationFn: (options: ProposeDateOption[]) => reviseDates(groupId, taskId, options),
    onSuccess: () => {
      setRevising(false);
      invalidate();
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  if (isLoading || !schedule) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const confirmRevise = () => {
    Alert.alert(
      "Add more dates?",
      "This is your one-time revision for this task - once you send it back to the Tribe, you won't be able to add more dates again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Add dates", onPress: () => setRevising(true) },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{taskName}</Text>

      {schedule.workDay ? (
        <ConfirmedView workDay={schedule.workDay} taskName={taskName} />
      ) : schedule.isOwner ? (
        revising ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add more dates</Text>
            <Text style={styles.hint}>This is a one-time revision. Once sent, the Tribe resubmits their availability.</Text>
            <OwnerCalendarPicker
              existingDates={schedule.proposal!.options.map((o) => toDateString(new Date(o.date)))}
              windowStart={schedule.windowStart}
              windowEnd={schedule.windowEnd}
              busy={reviseMutation.isPending}
              submitLabel="Send revised dates to Tribe"
              onSubmit={(options) => reviseMutation.mutate(options)}
            />
            <TouchableOpacity style={styles.linkButton} onPress={() => setRevising(false)}>
              <Text style={styles.linkButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : !schedule.proposal ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Propose work dates</Text>
            <Text style={styles.hint}>
              Tap days on the calendar (dates outside your 2-week window are greyed out) and set a start time for
              each. If nothing's arranged before the window closes, this task is forfeited to the next person.
            </Text>
            <OwnerCalendarPicker
              existingDates={[]}
              windowStart={schedule.windowStart}
              windowEnd={schedule.windowEnd}
              busy={proposeMutation.isPending}
              submitLabel="Send to Tribe"
              onSubmit={(options) => proposeMutation.mutate(options)}
            />
          </View>
        ) : (
          <OwnerReviewView
            proposal={schedule.proposal}
            onConfirm={(id, food) => confirmMutation.mutate({ dateOptionId: id, foodProvided: food })}
            onRevise={confirmRevise}
          />
        )
      ) : !schedule.proposal ? (
        <Text style={styles.hint}>Waiting for the task owner to propose some dates.</Text>
      ) : schedule.proposal.mySubmitted ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your availability</Text>
          <Text style={styles.hint}>You've submitted your availability. Waiting on the task owner to confirm a date.</Text>
          {schedule.proposal.options.map((option) => (
            <View key={option.id} style={styles.submittedRow}>
              <Text style={styles.optionDate}>
                {formatDateLabel(toDateString(new Date(option.date)))} {option.startTime ? formatTime12h(option.startTime) : ""}
              </Text>
              <Text style={[styles.responseTag, option.myResponse ? styles.responseTagYes : styles.responseTagNo]}>
                {option.myResponse ? "Available" : "Can't make it"}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <MemberRespondView
          options={schedule.proposal.options}
          onSubmit={(availableIds) => submitMutation.mutate(availableIds)}
          busy={submitMutation.isPending}
        />
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
    : `${new Date(workDay.confirmedDate).toDateString()} ${workDay.startTime}`;

  const addToCalendar = async () => {
    try {
      const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
      if (status !== "granted") return;
      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find((c) => c.allowsModifications) ?? calendars[0];
      if (!defaultCalendar) return;

      const start = new Date(workDay!.confirmedDate);
      const end = workDay!.allDay ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

      await ExpoCalendar.createEventAsync(defaultCalendar.id, {
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
      <Text style={styles.hint}>{workDay!.foodProvided ? "Snacks provided" : "No food provided - bring your own"}</Text>
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

function OwnerReviewView({
  proposal,
  onConfirm,
  onRevise,
}: {
  proposal: NonNullable<ScheduleInfo["proposal"]>;
  onConfirm: (id: string, foodProvided: boolean) => void;
  onRevise: () => void;
}) {
  const [foodByOption, setFoodByOption] = useState<Record<string, boolean>>({});
  const markedDates: Record<string, any> = {};
  for (const option of proposal.options) {
    markedDates[toDateString(new Date(option.date))] = { marked: true, dotColor: colors.primary, disabled: true, disableTouchEvent: true };
  }

  return (
    <View style={styles.section}>
      <Calendar
        markedDates={markedDates}
        current={proposal.options[0] ? toDateString(new Date(proposal.options[0].date)) : undefined}
        theme={calendarTheme}
        style={styles.calendar}
      />

      {!proposal.allSubmitted && (
        <Text style={styles.hint}>
          Waiting for {proposal.submittedCount} of {proposal.requiredSubmitterCount} members to respond.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Proposed dates</Text>
      {proposal.options.map((option) => (
        <View key={option.id} style={styles.optionCard}>
          <Text style={styles.optionDate}>
            {formatDateLabel(toDateString(new Date(option.date)))} {option.startTime ? formatTime12h(option.startTime) : ""}
          </Text>
          <Text style={styles.hint}>
            {option.availableCount} available · {option.unavailableCount} unavailable
          </Text>

          {proposal.allSubmitted && (
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
      ))}

      {proposal.allSubmitted && !proposal.revisionUsed && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onRevise}>
          <Text style={styles.secondaryButtonText}>Add more dates instead (one-time revision)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MemberRespondView({
  options,
  onSubmit,
  busy,
}: {
  options: DateOptionInfo[];
  onSubmit: (availableDateOptionIds: string[]) => void;
  busy: boolean;
}) {
  // Purely local until Submit - toggling a date is instant with no network
  // call. Anything left off defaults to "not available" (both here and on
  // the server once submitted), so there's nothing to force-answer first.
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setAvailable((prev) => ({ ...prev, [id]: !prev[id] }));

  const markedDates: Record<string, any> = {};
  for (const option of options) {
    const dateString = toDateString(new Date(option.date));
    const isAvailable = Boolean(available[option.id]);
    const color = isAvailable ? colors.primary : colors.danger;
    markedDates[dateString] = { marked: true, dotColor: color, selected: true, selectedColor: color };
  }

  const onDayPress = (day: { dateString: string }) => {
    const option = options.find((o) => toDateString(new Date(o.date)) === day.dateString);
    if (option) toggle(option.id);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>When can you make it?</Text>
      <Text style={styles.hint}>Switch on the dates you're available for, then submit. Anything left off counts as not available.</Text>
      <Calendar markedDates={markedDates} onDayPress={onDayPress} theme={calendarTheme} style={styles.calendar} />

      {options.map((option) => {
        const isAvailable = Boolean(available[option.id]);
        return (
          <View key={option.id} style={styles.optionCard}>
            <View style={styles.availabilityRow}>
              <Text style={styles.optionDate}>
                {formatDateLabel(toDateString(new Date(option.date)))} {option.startTime ? formatTime12h(option.startTime) : ""}
              </Text>
              <Switch value={isAvailable} onValueChange={() => toggle(option.id)} trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
            <Text style={[styles.responseTag, isAvailable ? styles.responseTagYes : styles.responseTagNo]}>
              {isAvailable ? "Available" : "Not available"}
            </Text>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.primaryButtonSmall}
        onPress={() => onSubmit(Object.keys(available).filter((id) => available[id]))}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit my availability</Text>}
      </TouchableOpacity>
      <Text style={styles.hint}>Once submitted you won't be able to change your answers for this round.</Text>
    </View>
  );
}

function OwnerCalendarPicker({
  existingDates,
  windowStart,
  windowEnd,
  busy,
  submitLabel,
  onSubmit,
}: {
  existingDates: string[];
  windowStart: string;
  windowEnd: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (options: ProposeDateOption[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [timePickerFor, setTimePickerFor] = useState<string | null>(null);

  const onDayPress = (day: { dateString: string }) => {
    if (day.dateString < windowStart || day.dateString > windowEnd) return;
    if (existingDates.includes(day.dateString)) return;
    setSelected((prev) => {
      if (prev[day.dateString]) {
        const { [day.dateString]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [day.dateString]: "09:00" };
    });
    if (!selected[day.dateString]) setTimePickerFor(day.dateString);
  };

  const removeDate = (dateString: string) =>
    setSelected((prev) => {
      const { [dateString]: _removed, ...rest } = prev;
      return rest;
    });

  const markedDates: Record<string, any> = {};
  for (const d of existingDates) {
    markedDates[d] = { marked: true, dotColor: colors.textMuted, disabled: true, disableTouchEvent: true };
  }
  for (const d of Object.keys(selected)) {
    markedDates[d] = { selected: true, selectedColor: colors.primary };
  }

  const selectedEntries = Object.entries(selected).sort(([a], [b]) => a.localeCompare(b));

  return (
    <View>
      <Calendar
        current={windowStart}
        minDate={windowStart}
        maxDate={windowEnd}
        markedDates={markedDates}
        onDayPress={onDayPress}
        theme={calendarTheme}
        style={styles.calendar}
      />

      {selectedEntries.map(([dateString, time]) => (
        <View key={dateString} style={styles.dateRow}>
          <Text style={styles.optionDate}>{formatDateLabel(dateString)}</Text>
          <TouchableOpacity style={styles.timeButton} onPress={() => setTimePickerFor(dateString)}>
            <Text style={styles.timeButtonText}>{formatTime12h(time)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeDate(dateString)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Modal visible={timePickerFor != null} transparent animationType="fade" onRequestClose={() => setTimePickerFor(null)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setTimePickerFor(null)}>
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
                    if (timePickerFor) setSelected((prev) => ({ ...prev, [timePickerFor]: item }));
                    setTimePickerFor(null);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerRowText,
                      timePickerFor && selected[timePickerFor] === item && styles.pickerRowTextSelected,
                    ]}
                  >
                    {formatTime12h(item)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={[styles.primaryButtonSmall, selectedEntries.length === 0 && styles.buttonDisabled]}
        disabled={selectedEntries.length === 0 || busy}
        onPress={() =>
          onSubmit(selectedEntries.map(([dateString, time]) => ({ date: dateStringToISO(dateString), allDay: false, startTime: time })))
        }
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{submitLabel}</Text>}
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
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  optionCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  availabilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  optionDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  submittedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  responseTag: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginTop: spacing.xs },
  responseTagYes: { color: colors.primary },
  responseTagNo: { color: colors.danger },
  ownerBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  foodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: spacing.sm },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  timeButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  timeButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  removeText: { color: colors.danger, fontSize: 16, paddingHorizontal: spacing.sm },
  linkButton: { marginTop: spacing.sm },
  linkButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md },
  primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginTop: spacing.md },
  secondaryButtonText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: "70%" },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  pickerList: { maxHeight: 320 },
  pickerRow: { paddingVertical: spacing.sm },
  pickerRowText: { fontSize: 15, color: colors.text },
  pickerRowTextSelected: { color: colors.primary, fontWeight: "700" },
});
