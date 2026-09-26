import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '../components/Button';
import DotText from '../components/dot/DotText';
import Screen from '../components/Screen';
import Tile from '../components/Tile';
import { useAuth } from '../lib/auth';
import {
  MANAGE_SUBSCRIPTION_URL,
  billingConfigured,
  buyPackage,
  loadPackages,
  restorePurchases,
} from '../lib/billing';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../lib/config';
import { formatShortDate } from '../lib/dates';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function features(plan) {
  const lines = [];
  lines.push(
    plan.research_per_month == null
      ? 'Unlimited organisation research'
      : `${plan.research_per_month} organisation researches a month`
  );
  lines.push('Saved research reused in every mock interview');
  lines.push(
    plan.daily_ai_calls == null
      ? 'Unlimited mock interviews'
      : 'Unlimited mock interviews, fair use applies'
  );
  lines.push('STAR story bank and score history');
  return lines;
}

export default function UpgradeScreen({ navigation }) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts, radius);
  const { entitlements, refreshEntitlements } = useAuth();
  const [plans, setPlans] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const isPaid = entitlements && entitlements.plan_id !== 'free';

  useEffect(() => {
    supabase
      .from('plans')
      .select('id,name,description,price_label,research_per_month,daily_ai_calls,sort')
      .eq('active', true)
      .order('sort')
      .then(({ data }) => setPlans(data ?? []));
    loadPackages()
      .then(setPackages)
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));
    refreshEntitlements();
  }, [refreshEntitlements]);

  // The store tells RevenueCat, RevenueCat tells our webhook, the webhook
  // updates the database. That takes a few seconds, so check a few times.
  const waitForUpgrade = useCallback(async () => {
    for (let i = 0; i < 8; i++) {
      const ent = await refreshEntitlements();
      if (ent && ent.plan_id !== 'free') return true;
      await sleep(2000);
    }
    return false;
  }, [refreshEntitlements]);

  const buy = async (pkg) => {
    setBusy(pkg.identifier);
    setMessage(null);
    const result = await buyPackage(pkg);
    if (result.cancelled) {
      setBusy(null);
      return;
    }
    if (result.error) {
      setBusy(null);
      setMessage("The purchase didn't go through. You haven't been charged.");
      return;
    }
    const upgraded = await waitForUpgrade();
    setBusy(null);
    setMessage(
      upgraded
        ? "You're on Pro. Thank you!"
        : 'Purchase received. Your plan will update within a minute. Reopen this screen if it does not.'
    );
  };

  const restore = async () => {
    setBusy('restore');
    setMessage(null);
    const result = await restorePurchases();
    if (result.error) {
      setBusy(null);
      setMessage(
        result.error.message === 'not_configured'
          ? "Purchases aren't set up in this build."
          : "Couldn't restore purchases. Check your connection and try again."
      );
      return;
    }
    const upgraded = await waitForUpgrade();
    setBusy(null);
    setMessage(upgraded ? 'Your subscription is active again.' : 'No active subscription found for this store account.');
  };

  const paidPlan = plans.find((p) => p.id !== 'free');

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ marginBottom: 18 }}>
        <Text style={styles.back}>Close</Text>
      </Pressable>
      <DotText text="UPGRADE" dot={5} gap={2} />

      {entitlements ? (
        <Text style={styles.current}>
          You're on {entitlements.plan_name}.
          {isPaid && entitlements.period_end
            ? entitlements.auto_renew
              ? ` Renews ${formatShortDate(entitlements.period_end)}.`
              : ` Access runs until ${formatShortDate(entitlements.period_end)}.`
            : ''}
        </Text>
      ) : null}

      {plans.map((plan, i) => {
        const current = entitlements?.plan_id === plan.id;
        return (
          <Tile
            key={plan.id}
            index={String(i + 1).padStart(2, '0')}
            label={plan.name}
            style={{ marginBottom: 12, borderColor: plan.id === 'pro' ? colors.accent : colors.line }}
            right={
              current ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Current</Text>
                </View>
              ) : null
            }
          >
            {plan.description ? <Text style={styles.desc}>{plan.description}</Text> : null}
            {features(plan).map((f) => (
              <Text key={f} style={styles.feature}>
                - {f}
              </Text>
            ))}
          </Tile>
        );
      })}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!isPaid && paidPlan ? (
        <View style={{ marginTop: 8 }}>
          {!billingConfigured() ? (
            <Text style={styles.note}>
              Purchases aren't set up in this build yet, so upgrading isn't
              available here.
            </Text>
          ) : loadingPackages ? (
            <Text style={styles.note}>Loading prices...</Text>
          ) : packages.length === 0 ? (
            <Text style={styles.note}>No subscription is available right now. Try again later.</Text>
          ) : (
            packages.map((pkg) => (
              <Button
                key={pkg.identifier}
                title={`Upgrade to ${paidPlan.name}: ${pkg.product?.priceString ?? ''} ${
                  pkg.packageType === 'ANNUAL' ? 'a year' : pkg.packageType === 'MONTHLY' ? 'a month' : ''
                }`.trim()}
                onPress={() => buy(pkg)}
                loading={busy === pkg.identifier}
                disabled={!!busy}
                style={{ marginBottom: 10 }}
              />
            ))
          )}
        </View>
      ) : null}

      <Button
        title="Restore purchases"
        variant="outline"
        onPress={restore}
        loading={busy === 'restore'}
        disabled={!!busy}
        style={{ marginTop: 6 }}
      />
      {isPaid ? (
        <Button
          title="Manage subscription"
          variant="ghost"
          onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
        />
      ) : null}

      <Text style={styles.legal}>
        {Platform.OS === 'ios'
          ? "Payment is charged to your Apple ID at confirmation of purchase. "
          : 'Payment is charged to your Google Play account at confirmation of purchase. '}
        Subscriptions renew automatically unless cancelled at least 24 hours
        before the end of the current period. Manage or cancel any time in your
        store account settings.
      </Text>
      <View style={styles.links}>
        {TERMS_URL ? (
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.link}>Terms of use</Text>
          </Pressable>
        ) : null}
        {PRIVACY_POLICY_URL ? (
          <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={styles.link}>Privacy policy</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const getStyles = (colors, fonts, radius) =>
  StyleSheet.create({
  back: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },
  current: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mute,
    marginTop: 20,
    marginBottom: 22,
  },
  desc: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.mute, marginBottom: 10 },
  feature: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 20, color: colors.ink },
  pill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.ink },
  message: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.ink, marginVertical: 12 },
  note: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.mute, marginBottom: 12 },
  legal: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 16, color: colors.faint, marginTop: 22 },
  links: { flexDirection: 'row', gap: 18, marginTop: 12 },
  link: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
});
