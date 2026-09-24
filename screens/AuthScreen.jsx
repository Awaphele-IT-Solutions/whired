import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '../components/Button';
import DotText from '../components/dot/DotText';
import Field from '../components/Field';
import Screen from '../components/Screen';
import SocialButtons from '../components/SocialButtons';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';

const COPY = {
  signup: {
    title: 'Create your account',
    button: 'Create account',
    switchText: 'Already have an account?',
    switchAction: 'Log in',
    switchTo: 'login',
  },
  login: {
    title: 'Welcome back',
    button: 'Log in',
    switchText: "New here?",
    switchAction: 'Create an account',
    switchTo: 'signup',
  },
  forgot: {
    title: 'Reset your password',
    button: 'Send reset link',
    switchText: 'Remembered it?',
    switchAction: 'Back to log in',
    switchTo: 'login',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const copy = COPY[mode];

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode !== 'forgot' && password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) return setError(err.message);
        // With email confirmation on there is no session yet.
        if (!data.session) {
          setMode('login');
          setNotice('Check your inbox and confirm your email, then log in.');
        }
      } else if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) return setError(err.message);
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (err) return setError(err.message);
        setMode('login');
        setNotice('If that email has an account, a reset link is on its way.');
      }
    } catch (e) {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 48 }}>
      <DotText text="W/HIRED" dot={5} gap={2} accentChars="/" />
      <Text style={styles.tagline}>Rehearse the interview before it counts.</Text>

      <Text style={styles.title}>{copy.title}</Text>

      {mode !== 'forgot' ? <SocialButtons onError={setError} /> : null}

      {mode === 'signup' ? (
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
      ) : null}

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />

      {mode !== 'forgot' ? (
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
        />
      ) : null}

      {mode === 'login' ? (
        <Text style={styles.link} onPress={() => switchMode('forgot')}>
          Forgot your password?
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Button title={copy.button} onPress={submit} loading={loading} />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{copy.switchText} </Text>
        <Text style={styles.link} onPress={() => switchMode(copy.switchTo)}>
          {copy.switchAction}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mute,
    marginTop: 18,
    marginBottom: 40,
  },
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.ink,
    marginBottom: 22,
  },
  link: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.accent,
    marginBottom: 18,
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.accent,
    marginBottom: 14,
  },
  notice: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
    marginBottom: 14,
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 26,
  },
  switchText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.mute,
  },
});
