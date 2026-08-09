import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmCheckout, createBillingPortalSession, createCheckoutSession, getSubscriptionStatus } from "../api/subscription";
import { toggleSubscriptionDev } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function SubscriptionScreen() {
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: status, isLoading } = useQuery({ queryKey: ["subscription"], queryFn: getSubscriptionStatus });

  const afterChange = async () => {
    await refreshProfile();
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  };

  const onSubscribe = async () => {
    setError(null);
    setBusy(true);
    try {
      const redirectUri = Linking.createURL("subscription");
      const { url, sessionId } = await createCheckoutSession(redirectUri);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type === "success") {
        await confirmCheckout(sessionId);
        await afterChange();
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onManageBilling = async () => {
    setError(null);
    setBusy(true);
    try {
      const redirectUri = Linking.createURL("subscription");
      const { url } = await createBillingPortalSession(redirectUri);
      await WebBrowser.openAuthSessionAsync(url, redirectUri);
      await afterChange();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onDevToggle = async () => {
    setBusy(true);
    try {
      await toggleSubscriptionDev();
      await afterChange();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !status) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.tier}>{status.tier === "SUBSCRIBER" ? "Subscriber" : "Free plan"}</Text>
        {status.tier === "SUBSCRIBER" ? (
          <Text style={styles.body}>
            Up to 20 tasks, 6 Tribes, and you can form Tribes.
            {status.currentPeriodEnd ? ` Renews ${new Date(status.currentPeriodEnd).toDateString()}.` : ""}
          </Text>
        ) : (
          <Text style={styles.body}>1 task, 1 Tribe. Subscribe for £4.99/month to unlock more.</Text>
        )}
      </View>

      {!status.stripeConfigured && (
        <Text style={styles.hint}>
          Billing isn't set up yet on the server (no Stripe key configured), so real checkout won't work. Use the
          dev toggle below to test Subscriber features in the meantime.
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {status.stripeConfigured && status.tier === "FREE" && (
        <TouchableOpacity style={styles.primaryButton} onPress={onSubscribe} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Subscribe — £4.99/month</Text>}
        </TouchableOpacity>
      )}

      {status.stripeConfigured && status.tier === "SUBSCRIBER" && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onManageBilling} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Manage billing / cancel</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.devButton} onPress={onDevToggle} disabled={busy}>
        <Text style={styles.devButtonText}>Dev: switch to {status.tier === "SUBSCRIBER" ? "Free" : "Subscriber"}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        The dev toggle is a free instant switch for testing — it bypasses Stripe entirely. Use the real Subscribe
        button above to test the actual payment flow with Stripe's test card (4242 4242 4242 4242, any future date,
        any CVC) at no cost, since billing is in test mode.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg },
  tier: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },
  error: { color: colors.danger, marginBottom: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginBottom: spacing.lg },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginBottom: spacing.lg },
  secondaryButtonText: { color: colors.primary, fontWeight: "600" },
  devButton: { borderWidth: 1, borderColor: colors.textMuted, borderRadius: 10, padding: spacing.sm, alignItems: "center", marginBottom: spacing.sm },
  devButtonText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
});
