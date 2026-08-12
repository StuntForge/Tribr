import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { colors, radii, spacing } from "../theme";

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Calendar cells give us plain "YYYY-MM-DD" strings - build the Date at
// local noon so a UTC round-trip (toISOString) can never drift it a day.
export function dateStringToISO(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function formatDateLabel(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatTime12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Shared formatter for a Social Tribe's Fixed Date + time, used anywhere a
// Social Tribe summary is shown (Browse Groups cards/markers, invitation
// cards) so the display is identical everywhere rather than reimplemented
// per screen.
export function formatSocialEventDate(group: {
  dateType?: string | null;
  fixedDate?: string | Date | null;
  fixedStartTime?: string | null;
}): string {
  if (group.dateType !== "FIXED" || !group.fixedDate) return "Date: To be arranged";
  const d = new Date(group.fixedDate);
  const dateLabel = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (!group.fixedStartTime) return dateLabel;
  return `${dateLabel}, ${formatTime12h(group.fixedStartTime)}`;
}

export const TIME_OPTIONS: string[] = (() => {
  const times: string[] = [];
  for (let h = 7; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30) continue;
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
})();

export const calendarTheme = {
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

export interface CalendarPickerDateOption {
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
}

// A leader/owner picks one or more dates (each with a start time) within an
// allowed window. Used by both Work Tribe task scheduling and Social Tribe
// "Schedule Together" proposals - the two flows differ only in what they do
// with the resulting list of dates, not in how the dates get picked.
export default function CalendarPicker({
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
  onSubmit: (options: CalendarPickerDateOption[]) => void;
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
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  optionDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  timeButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  timeButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  removeText: { color: colors.danger, fontSize: 16, paddingHorizontal: spacing.sm },
  primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: "70%" },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  pickerList: { maxHeight: 320 },
  pickerRow: { paddingVertical: spacing.sm },
  pickerRowText: { fontSize: 15, color: colors.text },
  pickerRowTextSelected: { color: colors.primary, fontWeight: "700" },
});
