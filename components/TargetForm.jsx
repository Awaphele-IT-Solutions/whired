import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { addDays, parseDayKey, startOfToday, toDayKey } from '../lib/dates';
import { useTheme } from '../lib/ThemeContext';
import Button from './Button';
import Chip from './Chip';
import Field from './Field';

export const LEVELS = [
  { key: 'entry', label: 'Student or entry' },
  { key: 'mid', label: 'Mid-level' },
  { key: 'senior', label: 'Senior' },
  { key: 'switch', label: 'Career switch' },
];

const DATE_PRESETS = [
  { label: 'This week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
];

// Shared by onboarding and the profile tab.
export default function TargetForm({ initial, submitLabel, loading, onSubmit }) {
  const { colors, fonts } = useTheme();
  const styles = getStyles(colors, fonts);
  const [name, setName] = useState(initial?.display_name ?? '');
  const [role, setRole] = useState(initial?.target_role ?? '');
  const [company, setCompany] = useState(initial?.target_company ?? '');
  const [level, setLevel] = useState(initial?.experience_level ?? 'mid');
  const [date, setDate] = useState(initial?.interview_date ?? '');
  const [error, setError] = useState(null);

  const submit = () => {
    if (!role.trim()) {
      setError('Add the role you are preparing for.');
      return;
    }
    if (date) {
      const parsed = parseDayKey(date);
      if (!parsed) {
        setError('Use the date format YYYY-MM-DD, for example 2026-11-14.');
        return;
      }
      if (parsed < startOfToday()) {
        setError('Pick today or a later date for your interview.');
        return;
      }
    }
    setError(null);
    onSubmit({
      display_name: name.trim() || null,
      target_role: role.trim(),
      target_company: company.trim() || null,
      experience_level: level,
      interview_date: date || null,
    });
  };

  return (
    <View>
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="What should we call you?"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      <Field
        label="Role"
        value={role}
        onChangeText={setRole}
        placeholder="e.g. Product designer"
        autoCapitalize="words"
      />
      <Field
        label="Company"
        value={company}
        onChangeText={setCompany}
        placeholder="Your dream company"
        autoCapitalize="words"
        hint="Optional. Mock interviews are tailored to it."
      />

      <Text style={styles.label}>Where are you in your career?</Text>
      <View style={styles.row}>
        {LEVELS.map((l) => (
          <Chip
            key={l.key}
            label={l.label}
            selected={level === l.key}
            onPress={() => setLevel(l.key)}
          />
        ))}
      </View>

      <Text style={styles.label}>Interview date</Text>
      <View style={styles.row}>
        {DATE_PRESETS.map((p) => {
          const key = toDayKey(addDays(startOfToday(), p.days));
          return (
            <Chip
              key={p.days}
              label={p.label}
              selected={date === key}
              onPress={() => setDate(key)}
            />
          );
        })}
        <Chip label="Not set" selected={date === ''} onPress={() => setDate('')} />
      </View>
      <Field
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        hint="Or type an exact date."
        style={{ marginTop: 14 }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}

const getStyles = (colors, fonts) =>
  StyleSheet.create({
    label: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.mute,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 18,
    },
    error: {
      fontFamily: fonts.mono,
      fontSize: 12,
      lineHeight: 18,
      color: colors.accent,
      marginBottom: 14,
    },
  });
