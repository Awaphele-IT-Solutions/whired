import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../lib/ThemeContext';

// The shared glassmorphic + 3D surface behind tiles, buttons, fields and the
// tab bar: a real frosted blur, a translucent tint, a hairline border, a
// soft top sheen (the "curved glass" highlight), and a lifted shadow. One
// place to tune the look so every surface in the app reads consistently.
export default function GlassSurface({
  style,
  radius: radiusOverride,
  intensity = 34,
  elevated = true,
  bordered = true,
  children,
}) {
  const { colors, radius } = useTheme();
  const r = radiusOverride ?? radius.card;

  return (
    <View
      style={[
        { borderRadius: r },
        elevated && {
          shadowColor: colors.shadowColor,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View style={{ borderRadius: r, overflow: 'hidden' }}>
        <BlurView
          intensity={intensity}
          tint={colors.glassTint}
          style={StyleSheet.absoluteFill}
        >
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFill }]}
          />
          <LinearGradient
            colors={colors.glassHighlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>
        {bordered ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: r, borderWidth: 1, borderColor: colors.glassBorder },
            ]}
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}
