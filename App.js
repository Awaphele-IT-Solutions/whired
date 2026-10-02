import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './lib/auth';
import { isSupabaseConfigured } from './lib/supabase';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import { colors as darkColors } from './lib/theme';
import RootNavigator from './navigation';

function AppShell() {
  if (!isSupabaseConfigured) {
    return <ConfigWarning />;
  }
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function ConfigWarning() {
  const { colors, fonts } = useTheme();
  const styles = getConfigStyles(colors, fonts);
  return (
    <View style={styles.config}>
      <Text style={styles.configTitle}>Supabase isn't set up yet</Text>
      <Text style={styles.configBody}>
        Copy .env.example to .env, add your project URL and publishable key,
        then restart with `npx expo start -c`.
      </Text>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceMonoRegular: SpaceMono_400Regular,
    SpaceMonoBold: SpaceMono_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: darkColors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const getConfigStyles = (colors, fonts) =>
  StyleSheet.create({
    config: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      padding: 28,
    },
    configTitle: {
      fontFamily: fonts.monoBold,
      fontSize: 18,
      color: colors.ink,
      marginBottom: 12,
    },
    configBody: {
      fontFamily: fonts.mono,
      fontSize: 13,
      lineHeight: 20,
      color: colors.mute,
    },
  });
