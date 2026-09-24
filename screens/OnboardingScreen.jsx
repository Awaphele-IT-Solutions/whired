import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import DotText from '../components/dot/DotText';
import Screen from '../components/Screen';
import TargetForm from '../components/TargetForm';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../lib/theme';

export default function OnboardingScreen() {
  const { profile, user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const initial = {
    display_name: profile?.display_name ?? user?.user_metadata?.name ?? '',
    target_role: profile?.target_role ?? '',
    target_company: profile?.target_company ?? '',
    experience_level: profile?.experience_level ?? 'mid',
    interview_date: profile?.interview_date ?? '',
  };

  const save = async (values) => {
    setSaving(true);
    const { error } = await updateProfile({ ...values, onboarded: true });
    setSaving(false);
    // On success the profile flips to onboarded and the navigator swaps screens.
    if (error) Alert.alert("Couldn't save", error.message);
  };

  return (
    <Screen contentStyle={{ paddingTop: 48 }}>
      <DotText text="TARGET" dot={5} gap={2} />
      <Text style={styles.title}>What are you aiming for?</Text>
      <Text style={styles.body}>
        Your dashboard and mock interviews are built around the role and company
        you tell us about. You can change this any time.
      </Text>
      <TargetForm initial={initial} submitLabel="Build my dashboard" loading={saving} onSubmit={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.ink,
    marginTop: 26,
    marginBottom: 10,
  },
  body: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mute,
    marginBottom: 28,
  },
});
