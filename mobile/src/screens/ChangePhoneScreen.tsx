import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { confirmPhoneChange, requestPhoneChange } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function ChangePhoneScreen({ navigation }: any) {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRequest = async () => {
    setError(null);
    if (newPhone.trim().length < 6) {
      setError("Enter a valid mobile number, including country code.");
      return;
    }
    setBusy(true);
    try {
      await requestPhoneChange(newPhone.trim());
      setStep("code");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await confirmPhoneChange(newPhone.trim(), code.trim());
      await refreshProfile();
      navigation.goBack();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change mobile number</Text>
      <Text style={styles.subtitle}>
        Your history, ratings and active groups stay exactly as they are — only your login number changes.
      </Text>

      {step === "phone" ? (
        <>
          <Text style={styles.label}>New mobile number</Text>
          <TextInput
            style={styles.input}
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="+44 7700 900000"
            keyboardType="phone-pad"
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={onRequest} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter the code sent to {newPhone}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={onConfirm} disabled={busy || code.length < 4}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 15,
  },
  error: { color: colors.danger, marginTop: spacing.md },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: "600" },
});
