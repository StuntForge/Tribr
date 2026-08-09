import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { requestCode } from "../../api/auth";
import { colors, spacing } from "../../theme";

export default function PhoneEntryScreen({ navigation }: any) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onContinue = async () => {
    setError(null);
    if (phone.trim().length < 6) {
      setError("Enter a valid mobile number, including country code (e.g. +44...).");
      return;
    }
    setSubmitting(true);
    try {
      await requestCode(phone.trim());
      navigation.navigate("VerifyCode", { phone: phone.trim() });
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require("../../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Tribr</Text>
      <Text style={styles.subtitle}>
        Trade your labour, not your money. Enter your mobile number to get started.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="+44 7700 900000"
        keyboardType="phone-pad"
        autoFocus
        value={phone}
        onChangeText={setPhone}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={onContinue} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
      </TouchableOpacity>

      <Text style={styles.terms}>
        By continuing you agree to our Terms & Conditions and Privacy Policy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  logo: { width: 96, height: 96, alignSelf: "center", marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  terms: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, textAlign: "center" },
});
