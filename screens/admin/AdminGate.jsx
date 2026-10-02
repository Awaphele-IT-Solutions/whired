import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import DotText from '../../components/dot/DotText';
import Field from '../../components/Field';
import Screen from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';

// The admin console holds API keys and billing controls, so it requires a
// second factor (authenticator app code) every session. The server checks
// this too: the admin function rejects any token that isn't aal2.
export default function AdminGate({ onExit, children }) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts, radius);
  const [phase, setPhase] = useState('checking'); // checking | enroll | verify | ready | error
  const [factorId, setFactorId] = useState(null);
  const [secret, setSecret] = useState(null);
  const [uri, setUri] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    setPhase('checking');
    setError(null);
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setError(aalError.message);
      setPhase('error');
      return;
    }
    if (aal?.currentLevel === 'aal2') {
      setPhase('ready');
      return;
    }
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setPhase('error');
      return;
    }
    const verified = (factors?.totp ?? [])[0];
    if (verified) {
      setFactorId(verified.id);
      setPhase('verify');
      return;
    }
    // Clear half-finished enrolments before starting a new one.
    const abandoned = (factors?.all ?? []).filter(
      (f) => f.factor_type === 'totp' && f.status !== 'verified'
    );
    for (const f of abandoned) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'w/hired admin ' + Date.now(),
    });
    if (enrollError || !enrolled) {
      setError(enrollError?.message || 'Could not start two-factor setup.');
      setPhase('error');
      return;
    }
    setFactorId(enrolled.id);
    setSecret(enrolled.totp.secret);
    setUri(enrolled.totp.uri);
    setPhase('enroll');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't work. Check your phone's clock and try again.");
      return;
    }
    setCode('');
    setPhase('ready');
  };

  if (phase === 'ready') return children({ reverify: check });

  return (
    <Screen>
      <Pressable onPress={onExit} accessibilityRole="button" style={{ marginBottom: 18 }}>
        <Text style={styles.link}>Close</Text>
      </Pressable>
      <DotText text="ADMIN" dot={5} gap={2} />

      {phase === 'checking' ? <Text style={styles.body}>Checking your security level...</Text> : null}

      {phase === 'error' ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button title="Try again" onPress={check} />
        </>
      ) : null}

      {phase === 'enroll' ? (
        <>
          <Text style={styles.title}>Set up two-factor sign-in</Text>
          <Text style={styles.body}>
            The admin console can change API keys and plans, so it needs a code
            from an authenticator app. Add this account to Google Authenticator,
            1Password, Authy or similar, then enter the 6-digit code.
          </Text>
          <View style={styles.secretBox}>
            <Text style={styles.secretLabel}>Setup key</Text>
            <Text selectable style={styles.secret}>
              {secret}
            </Text>
          </View>
          <Button
            title="Open in authenticator app"
            variant="outline"
            onPress={() => uri && Linking.openURL(uri).catch(() => {})}
            style={{ marginBottom: 20 }}
          />
        </>
      ) : null}

      {phase === 'verify' ? (
        <>
          <Text style={styles.title}>Two-factor check</Text>
          <Text style={styles.body}>Enter the 6-digit code from your authenticator app.</Text>
        </>
      ) : null}

      {phase === 'enroll' || phase === 'verify' ? (
        <>
          <Field
            label="6-digit code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Verify" onPress={verify} loading={busy} />
        </>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors, fonts, radius) =>
  StyleSheet.create({
  link: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },
  title: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.ink, marginTop: 26, marginBottom: 10 },
  body: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, color: colors.mute, marginTop: 16, marginBottom: 20 },
  error: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.accent, marginBottom: 14 },
  secretBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.field,
    padding: 14,
    marginBottom: 14,
  },
  secretLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.faint,
    marginBottom: 6,
  },
  secret: { fontFamily: fonts.monoBold, fontSize: 14, letterSpacing: 1, color: colors.ink },
});
