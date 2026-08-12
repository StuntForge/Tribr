import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmSocialEvent,
  getSocialSchedule,
  ProposeSocialDateOption,
  proposeSocialDates,
  reviseSocialDates,
  SocialDateOptionInfo,
  SocialScheduleInfo,
  submitSocialAvailability,
} from "../../api/socialSchedule";
import CalendarPicker, { calendarTheme, formatDateLabel, formatTime12h, toDateString } from "../../components/CalendarPicker";
import { colors, spacing } from "../../theme";

// Mirrors TaskScheduleScreen.tsx's propose/respond/submit/confirm flow, but
// for a Social Tribe's single shared activity (no taskId, no food/dietary/
// address-reveal concepts - those are Work-Tribe-specific).
export default function SocialScheduleScreen({ route, navigation }: any) {
  const { groupId, groupName } = route.params as { groupId: string; groupName: string };
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);

  const { data: schedule, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["social-schedule", groupId],
    queryFn: () => getSocialSchedule(groupId),
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["social-schedule", groupId] });
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
  };

  const submitMutation = useMutation({
    mutationFn: (availableDateOptionIds: string[]) => submitSocialAvailability(groupId, availableDateOptionIds),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const confirmMutation = useMutation({
    mutationFn: (dateOptionId: string) => confirmSocialEvent(groupId, dateOptionId),
    onSuccess: () => {
      invalidate();
      navigation.navigate("GroupDetail", { groupId });
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const proposeMutation = useMutation({
    mutationFn: (options: ProposeSocialDateOption[]) => proposeSocialDates(groupId, options),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  const reviseMutation = useMutation({
    mutationFn: (options: ProposeSocialDateOption[]) => reviseSocialDates(groupId, options),
    onSuccess: () => {
      setRevising(false);
      invalidate();
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  if (isLoading || isFetching || !schedule) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const confirmRevise = () => {
    Alert.alert(
      "Add more dates?",
      "This is your one-time revision for this Tribe - once you send it back, you won't be able to add more dates again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Add dates", onPress: () => setRevising(true) },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{groupName}</Text>

      {schedule.socialEvent ? (
        <ConfirmedView socialEvent={schedule.socialEvent} groupName={groupName} groupId={groupId} navigation={navigation} />
      ) : schedule.isLeader ? (
        revising ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add more dates</Text>
            <Text style={styles.hint}>This is a one-time revision. Once sent, the Tribe resubmits their availability.</Text>
            <CalendarPicker
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
            <Text style={styles.sectionTitle}>Propose dates</Text>
            <Text style={styles.hint}>
              Tap days on the calendar (dates outside your 2-week window are greyed out) and set a start time for each.
            </Text>
            <CalendarPicker
              existingDates={[]}
              windowStart={schedule.windowStart}
              windowEnd={schedule.windowEnd}
              busy={proposeMutation.isPending}
              submitLabel="Send to Tribe"
              onSubmit={(options) => proposeMutation.mutate(options)}
            />
          </View>
        ) : (
          <LeaderReviewView
            proposal={schedule.proposal}
            onConfirm={(id) => confirmMutation.mutate(id)}
            onRevise={confirmRevise}
            confirmingId={confirmMutation.isPending ? confirmMutation.variables ?? null : null}
          />
        )
      ) : !schedule.proposal ? (
        <Text style={styles.hint}>Waiting for the Tribe leader to propose some dates.</Text>
      ) : schedule.proposal.mySubmitted ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your availability</Text>
          <Text style={styles.hint}>You've submitted your availability. Waiting on the leader to confirm a date.</Text>
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
  socialEvent,
  groupName,
  groupId,
  navigation,
}: {
  socialEvent: NonNullable<SocialScheduleInfo["socialEvent"]>;
  groupName: string;
  groupId: string;
  navigation: any;
}) {
  const dateLabel = socialEvent.allDay
    ? new Date(socialEvent.confirmedDate).toDateString()
    : `${new Date(socialEvent.confirmedDate).toDateString()} ${socialEvent.startTime}`;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Date confirmed</Text>
      <Text style={styles.confirmedDate}>{dateLabel}</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("GroupDetail", { groupId })}>
        <Text style={styles.secondaryButtonText}>Back to {groupName}</Text>
      </TouchableOpacity>
    </View>
  );
}

function LeaderReviewView({
  proposal,
  onConfirm,
  onRevise,
  confirmingId,
}: {
  proposal: NonNullable<SocialScheduleInfo["proposal"]>;
  onConfirm: (id: string) => void;
  onRevise: () => void;
  confirmingId: string | null;
}) {
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
            <TouchableOpacity
              style={styles.primaryButtonSmall}
              onPress={() => onConfirm(option.id)}
              disabled={confirmingId != null}
            >
              {confirmingId === option.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm this date</Text>
              )}
            </TouchableOpacity>
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
  options: SocialDateOptionInfo[];
  onSubmit: (availableDateOptionIds: string[]) => void;
  busy: boolean;
}) {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  confirmedDate: { fontSize: 16, fontWeight: "600", color: colors.primary, marginTop: spacing.xs },
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
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
  linkButton: { marginTop: spacing.sm },
  linkButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md },
  primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginTop: spacing.md },
  secondaryButtonText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
});
