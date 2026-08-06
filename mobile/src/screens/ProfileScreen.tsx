import React, { useState } from "react";
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
import { useAuth } from "../context/AuthContext";
import { addSkill, addTool, removeSkill, removeTool, setDietary } from "../api/profile";
import { colors, spacing } from "../theme";

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten Free", "Dairy Free", "Nut Allergy", "Other"];

export default function ProfileScreen({ navigation }: any) {
  const { profile, refreshProfile, signOut } = useAuth();
  const [newSkill, setNewSkill] = useState("");
  const [newTool, setNewTool] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!profile) return null;

  const onAddSkill = async () => {
    const label = newSkill.trim();
    if (!label) return;
    setNewSkill("");
    setBusy(true);
    try {
      await addSkill(label);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  const onRemoveSkill = async (id: string) => {
    setBusy(true);
    try {
      await removeSkill(id);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  const onAddTool = async () => {
    const label = newTool.trim();
    if (!label) return;
    setNewTool("");
    setBusy(true);
    try {
      await addTool(label);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  const onRemoveTool = async (id: string) => {
    setBusy(true);
    try {
      await removeTool(id);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  const toggleDietary = async (option: string) => {
    const next = profile.dietary.includes(option)
      ? profile.dietary.filter((d) => d !== option)
      : [...profile.dietary, option];
    setBusy(true);
    try {
      await setDietary(next);
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {profile.profilePhotoUrl && <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />}
        <Text style={styles.name}>{profile.firstName}</Text>
        <Text style={styles.meta}>
          {profile.age} · {profile.gender} · {profile.locationLabel}
        </Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>
            {profile.overallRating != null ? `★ ${profile.overallRating.toFixed(1)}` : "No ratings yet"}
          </Text>
          <Text style={styles.ratingSub}>{profile.completedCycles} cycles completed</Text>
        </View>
        {profile.overallRating != null && (
          <TouchableOpacity onPress={() => setShowBreakdown((v) => !v)}>
            <Text style={styles.breakdownToggle}>{showBreakdown ? "Hide" : "Show"} rating breakdown</Text>
          </TouchableOpacity>
        )}
        {showBreakdown && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownItem}>
              Worker: {profile.workerRating != null ? `★ ${profile.workerRating.toFixed(1)}` : "No ratings yet"}
            </Text>
            <Text style={styles.breakdownItem}>
              Host: {profile.hostRating != null ? `★ ${profile.hostRating.toFixed(1)}` : "No ratings yet"}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.bio}>{profile.bio}</Text>

      <Section title="Personal task library">
        <TouchableOpacity style={styles.taskLibraryButton} onPress={() => navigation.navigate("TaskLibrary")}>
          <Text style={styles.taskLibraryButtonText}>View my tasks</Text>
        </TouchableOpacity>
      </Section>

      <Section title="Skills">
        <ChipList items={profile.skills.map((s) => ({ id: s.id, label: s.label }))} onRemove={onRemoveSkill} />
        <AddRow value={newSkill} onChange={setNewSkill} onAdd={onAddSkill} placeholder="Add a skill" />
      </Section>

      <Section title="Tools you can bring">
        <ChipList items={profile.tools.map((t) => ({ id: t.id, label: t.label }))} onRemove={onRemoveTool} />
        <AddRow value={newTool} onChange={setNewTool} onAdd={onAddTool} placeholder="Add a tool" />
      </Section>

      <Section title="Dietary requirements">
        <Text style={styles.hint}>Only visible to members of groups you belong to.</Text>
        <View style={styles.chipRow}>
          {DIETARY_OPTIONS.map((option) => {
            const selected = profile.dietary.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleDietary(option)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <Section title="Subscription">
        <Text style={styles.hint}>
          {profile.subscriptionTier === "SUBSCRIBER"
            ? "You're a Subscriber — up to 20 tasks, 6 groups, and you can create groups."
            : "You're on the Free plan — 1 task, 1 group, and you can't create groups."}
        </Text>
        <TouchableOpacity style={styles.taskLibraryButton} onPress={() => navigation.navigate("Subscription")}>
          <Text style={styles.taskLibraryButtonText}>Manage subscription</Text>
        </TouchableOpacity>
      </Section>

      {busy && <ActivityIndicator style={{ marginTop: spacing.md }} />}

      <TouchableOpacity style={styles.taskLibraryButton} onPress={() => navigation.navigate("AccountSettings")}>
        <Text style={styles.taskLibraryButtonText}>Account settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={confirmSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipList({
  items,
  onRemove,
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <TouchableOpacity key={item.id} style={styles.chip} onPress={() => onRemove(item.id)}>
          <Text style={styles.chipText}>{item.label} ✕</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AddRow({
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <View style={styles.addRow}>
      <TextInput
        style={styles.addInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        onSubmitEditing={onAdd}
      />
      <TouchableOpacity style={styles.addButton} onPress={onAdd}>
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing.sm },
  name: { fontSize: 22, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  ratingText: { fontSize: 14, fontWeight: "600", color: colors.star },
  ratingSub: { fontSize: 12, color: colors.textMuted },
  breakdownToggle: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: spacing.sm },
  breakdownRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  breakdownItem: { fontSize: 13, color: colors.text },
  bio: { fontSize: 14, color: colors.text, textAlign: "center", marginBottom: spacing.lg, lineHeight: 20 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
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
  addRow: { flexDirection: "row", gap: spacing.sm },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  addButton: { justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: 8 },
  addButtonText: { color: "#fff", fontWeight: "600" },
  taskLibraryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
  },
  taskLibraryButtonText: { color: colors.primary, fontWeight: "600" },
  signOutButton: { marginTop: spacing.xl, alignItems: "center", padding: spacing.md },
  signOutText: { color: colors.danger, fontWeight: "600" },
});
