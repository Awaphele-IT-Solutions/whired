import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../lib/theme';

// Page shell: dark background, safe-area padding, optional scrolling, and
// keyboard avoidance for screens with inputs.
export default function Screen({
  children,
  scroll = true,
  bottomInset = true,
  contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const padTop = insets.top + 12;
  const padBottom = (bottomInset ? insets.bottom : 0) + 24;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 20 },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            { flex: 1, paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 20 },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
