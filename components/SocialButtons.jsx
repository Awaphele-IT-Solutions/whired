import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  appleAvailable,
  signInWithApple,
  signInWithBrowserProvider,
} from '../lib/oauth';
import { colors, fonts } from '../lib/theme';
import Button from './Button';

// Continue with Google / Microsoft / Apple. Apple appears on iOS only.
export default function SocialButtons({ onError }) {
  const [busy, setBusy] = useState(null);
  const [showApple, setShowApple] = useState(false);

  useEffect(() => {
    let alive = true;
    appleAvailable().then((ok) => alive && setShowApple(ok));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (key, fn) => {
    setBusy(key);
    onError(null);
    try {
      const result = await fn();
      if (result?.error) {
        onError("Couldn't sign you in. Please try again or use your email.");
      }
      // On success the auth listener swaps the screen; nothing else to do.
    } catch (e) {
      onError("Couldn't sign you in. Please try again or use your email.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View>
      {showApple ? (
        <Button
          title="Continue with Apple"
          variant="outline"
          loading={busy === 'apple'}
          disabled={!!busy}
          onPress={() => run('apple', signInWithApple)}
          style={styles.btn}
        />
      ) : null}
      <Button
        title="Continue with Google"
        variant="outline"
        loading={busy === 'google'}
        disabled={!!busy}
        onPress={() => run('google', () => signInWithBrowserProvider('google'))}
        style={styles.btn}
      />
      <Button
        title="Continue with Microsoft"
        variant="outline"
        loading={busy === 'microsoft'}
        disabled={!!busy}
        onPress={() => run('microsoft', () => signInWithBrowserProvider('microsoft'))}
        style={styles.btn}
      />
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or use email</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { marginBottom: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.faint,
  },
});
