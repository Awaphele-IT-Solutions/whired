import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import Button from '../components/Button';
import Chip from '../components/Chip';
import DotText from '../components/dot/DotText';
import Screen from '../components/Screen';
import TargetForm from '../components/TargetForm';
import Tile from '../components/Tile';
import { useAuth } from '../lib/auth';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '../lib/config';
import { formatShortDate } from '../lib/dates';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { useTabActive } from '../navigation/tabs';

const APPEARANCE_MODES = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { colors, fonts, mode, setMode, isDark } = useTheme();
  const styles = getStyles(colors, fonts);
  const navigation = useNavigation();
  const { user, profile, entitlements, isAdmin, updateProfile, signOut, deleteAccount } = useAuth();
  const isActive = useTabActive('you');
  const isFocused = useIsFocused();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('interview_sessions')
      .select('id, created_at, score, category, company, role')
      .order('created_at', { ascending: false })
      .limit(15);
    setHistory(data ?? []);
  }, []);

  useEffect(() => {
    if (isActive && isFocused) loadHistory();
  }, [isActive, isFocused, loadHistory]);

  const save = async (values) => {
    setSaving(true);
    setSaved(false);
    const { error } = await updateProfile(values);
    setSaving(false);
    if (error) Alert.alert("Couldn't save", error.message);
    else setSaved(true);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, mock interview history and stories. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await deleteAccount();
            setDeleting(false);
            if (error) Alert.alert("Couldn't delete your account", 'Check your connection and try again.');
          },
        },
      ]
    );
  };

  const links = [
    PRIVACY_POLICY_URL && { label: 'Privacy policy', url: PRIVACY_POLICY_URL },
    TERMS_URL && { label: 'Terms of use', url: TERMS_URL },
    SUPPORT_EMAIL && { label: 'Contact support', url: 'mailto:' + SUPPORT_EMAIL },
  ].filter(Boolean);

  return (
    <Screen>
      <DotText text="YOU" dot={5} gap={2} />
      <Text style={styles.email}>{user?.email}</Text>

      <Text style={styles.section}>Appearance</Text>
      <Tile label="Theme" style={{ marginBottom: 36 }}>
        <View style={styles.row}>
          {APPEARANCE_MODES.map((m) => (
            <Chip
              key={m.key}
              label={m.label}
              selected={mode === m.key}
              onPress={() => setMode(m.key)}
            />
          ))}
        </View>
        <Text style={styles.hint}>
          {mode === 'system'
            ? `Following your device, currently ${isDark ? 'dark' : 'light'}.`
            : `Always ${isDark ? 'dark' : 'light'}, regardless of your device.`}
        </Text>
      </Tile>

      <Text style={styles.section}>Target</Text>
      {/* key remounts the form when the saved profile changes underneath it */}
      <TargetForm
        key={profile?.updated_at || 'form'}
        initial={profile}
        submitLabel="Save changes"
        loading={saving}
        onSubmit={save}
      />
      {saved ? <Text style={styles.saved}>Saved.</Text> : null}

      <Text style={[styles.section, { marginTop: 36 }]}>History</Text>
      {history.length === 0 ? (
        <Text style={styles.empty}>Your finished mock interviews appear here.</Text>
      ) : (
        history.map((h, i) => (
          <Tile
            key={h.id}
            index={String(i + 1).padStart(2, '0')}
            label={formatShortDate(h.created_at)}
            style={{ marginBottom: 10 }}
            right={<DotText text={String(h.score ?? '--')} dot={3} gap={1.5} />}
          >
            <Text style={styles.rowTitle} numberOfLines={1}>
              {h.role || 'Mock interview'}
              {h.company ? ' at ' + h.company : ''}
            </Text>
            <Text style={styles.rowSub}>{h.category}</Text>
          </Tile>
        ))
      )}

      <Text style={[styles.section, { marginTop: 36 }]}>Plan</Text>
      <Tile label={entitlements ? entitlements.plan_name : 'Plan'} style={{ marginBottom: 10 }} onPress={() => navigation.navigate('Upgrade')}>
        <Text style={styles.rowTitle}>
          {entitlements
            ? entitlements.research_limit == null
              ? 'Unlimited organisation research'
              : `${Math.max(0, entitlements.research_limit - entitlements.research_used)} of ${entitlements.research_limit} research credits left`
            : 'Loading...'}
        </Text>
        <Text style={styles.rowSub}>
          {entitlements?.plan_id === 'free' ? 'See what Pro adds' : 'Manage your plan'}
        </Text>
      </Tile>
      {isAdmin ? (
        <Button
          title="Admin console"
          variant="outline"
          onPress={() => navigation.navigate('Admin')}
          style={{ marginBottom: 10 }}
        />
      ) : null}

      <Text style={[styles.section, { marginTop: 36 }]}>Account</Text>
      <Button title="Sign out" variant="outline" onPress={signOut} style={{ marginBottom: 10 }} />
      <Button
        title={deleting ? 'Deleting...' : 'Delete account'}
        variant="ghost"
        onPress={confirmDelete}
        disabled={deleting}
      />

      {links.length ? (
        <View style={styles.links}>
          {links.map((l) => (
            <Pressable key={l.label} onPress={() => Linking.openURL(l.url)}>
              <Text style={styles.link}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors, fonts) =>
  StyleSheet.create({
  email: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.mute,
    marginTop: 16,
    marginBottom: 28,
  },
  section: {
    fontFamily: fonts.monoBold,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 18,
  },
  saved: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    marginTop: 12,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.faint,
    marginTop: 12,
  },
  empty: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 19, color: colors.faint },
  rowTitle: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.ink },
  rowSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.mute,
    marginTop: 6,
    textTransform: 'capitalize',
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 28,
    justifyContent: 'center',
  },
  link: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
});
