import React, { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../lib/ThemeContext';
import AnimatedDotField from './AnimatedDotField';
import { useBackdrop } from './BackdropContext';

// Page shell: themed background, safe-area padding, optional scrolling,
// keyboard avoidance for screens with inputs, and a soft fade/rise-in for
// the content so every screen arrives with a little motion instead of
// popping in.
export default function Screen({
  children,
  scroll = true,
  bottomInset = true,
  contentStyle,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + 12;
  const hasBackdrop = useBackdrop(); // inside the tab shell: it owns the dots + bottom inset
  const padBottom = (bottomInset && !hasBackdrop ? insets.bottom : 0) + 24;

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const contentAnimStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: hasBackdrop ? 'transparent' : colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {hasBackdrop ? null : <AnimatedDotField />}
      {scroll ? (
        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 20 },
            contentStyle,
          ]}
          style={contentAnimStyle}
        >
          {children}
        </Animated.ScrollView>
      ) : (
        <Animated.View
          style={[
            { flex: 1, paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 20 },
            contentStyle,
            contentAnimStyle,
          ]}
        >
          {children}
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
