import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../lib/ThemeContext';

// The shared glassmorphic + 3D surface behind tiles, buttons, fields and the
// tab bar: a real frosted blur, a translucent tint, a hairline border, a
// soft top sheen (the "curved glass" highlight), and a lifted shadow.
//
// Layout note: the decorative layers (blur/tint/gradient/border) are
// absolutely positioned and round themselves individually, rather than
// living inside an extra `flex: 1` wrapper. A `flex: 1` child forces its
// basis to 0 before growing, which collapses to nothing when the parent
// (e.g. the tab bar, which has no explicit height) can't offer it space to
// grow into. Real content stays a normal, non-absolute child so it both
// sizes an auto-height surface (tab bar, buttons) and fills a fixed-height
// one (dashboard tiles) without that collapse risk.
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
      <BlurView
        intensity={intensity}
        tint={colors.glassTint}
        style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: colors.glassFill }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={colors.glassHighlight}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.7 }}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
      />
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
  );
}