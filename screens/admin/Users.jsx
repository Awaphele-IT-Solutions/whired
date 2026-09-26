import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import Button from '../../components/Button';
import Chip from '../../components/Chip';
import Field from '../../components/Field';
import Tile from '../../components/Tile';
import { adminCall } from '../../lib/admin';
import { useTheme } from '../../lib/ThemeContext';
import { getAdminStyles } from './common';

const DAYS = [30, 90, 365];
const when = (v) => (v ? new Date(v).toLocaleDateString() : 'never');

export default function Users({ plans }) {
  const { colors, fonts, radius } = useTheme();
  const s = getAdminStyles(colors, fonts, radius);
  const [email, setEmail] = useState('');
  const [user, setUser] = useState(undefined); // undefined = not searched, null = not found
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const paid = plans.find((p) => p.id !== 'free');

  const lookup = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await adminCall('user_lookup', { email });
      setUser(r.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action, payload, done) => {
    setBusy(true);
    try {
      await adminCall(action, payload);
      Alert.alert(done);
      const r = await adminCall('user_lookup', { email });
      setUser(r.user);
    } catch (e) {
      Alert.alert("Couldn't do that", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={[s.small, { marginBottom: 16 }]}>
        Look up a user by email to check their plan and usage. You see counts
        only, never their answers, stories or notes.
      </Text>
      <Field
        label="User email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title="Look up" onPress={lookup} loading={busy} style={{ marginBottom: 18 }} />

      {user === null ? <Text style={s.body}>No user with that email.</Text> : null}

      {user ? (
        <Tile label="User" style={{ marginBottom: 12 }}>
          <Text style={s.strong}>{user.email}</Text>
          <Text style={[s.small, { marginTop: 6 }]}>
            Joined {when(user.created_at)}, last seen {when(user.last_sign_in_at)}
            {user.provider ? `, via ${user.provider}` : ''}
          </Text>
          <Text style={[s.body, { marginTop: 14 }]}>Plan: {user.plan}</Text>
          {user.subscription ? (
            <Text style={s.small}>
              {user.subscription.source} subscription, {user.subscription.status}
              {user.subscription.period_end ? `, until ${when(user.subscription.period_end)}` : ''}
            </Text>
          ) : null}
          <Text style={[s.small, { marginTop: 14 }]}>
            {user.usage.research_this_month} researches this month, {user.usage.researches_saved} saved,{' '}
            {user.usage.ai_calls_today} AI calls today, {user.usage.sessions} mock sessions,{' '}
            {user.usage.stories} stories
          </Text>

          {paid ? (
            <View style={{ marginTop: 20 }}>
              <Text style={s.label}>Grant {paid.name} for</Text>
              <View style={s.chips}>
                {DAYS.map((d) => (
                  <Chip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />
                ))}
              </View>
              <Button
                title={`Grant ${paid.name}`}
                onPress={() => act('user_grant', { user_id: user.id, plan_id: paid.id, days }, 'Access granted.')}
                loading={busy}
                style={{ marginBottom: 10 }}
              />
              {user.subscription?.source === 'manual' ? (
                <Button
                  title="Revoke manual grant"
                  variant="outline"
                  onPress={() => act('user_revoke', { user_id: user.id }, 'Grant revoked.')}
                />
              ) : null}
              <Text style={[s.small, { marginTop: 10, color: colors.faint }]}>
                Store subscriptions can only be ended through the App Store or Google Play.
              </Text>
            </View>
          ) : null}
        </Tile>
      ) : null}
    </View>
  );
}
