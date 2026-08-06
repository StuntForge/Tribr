import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { verifyCode, requestCode } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

export default function VerifyCodeScreen({ route }: any) {
  const { phone } = route.params as { phone: string };
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  const onVerify = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyCode(phone, code.trim(), true);
      await signIn(result.token);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      await requestCode(phone);
      setResent(true);
    } catch (e: any) {
      setError(e.message ?? "Could not resend the code.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {phone}.</Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {resent && <Text style={styles.hint}>A new code was sent.</Text>}

      <TouchableOpacity style={styles.button} onPress={onVerify} disabled={submitting || code.length < 4}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onResend} style={styles.resend}>
        <Text style={styles.resendText}>Resend code</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  hint: { color: colors.primary, marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resend: { marginTop: spacing.lg, alignItems: "center" },
  resendText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
});
