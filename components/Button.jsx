import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../lib/ThemeContext';
import AnimatedPressable from './AnimatedPressable';
import GlassSurface from './GlassSurface';

// variant: 'primary' (accent gradient fill, embossed) | 'outline' (glass) |
// 'ghost' (transparent). Every variant shares the same 3D press animation.
export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts, radius);
  const isPrimary = variant === 'primary';
  const off = disabled || loading;

  const label = loading ? (
    <ActivityIndicator color={isPrimary ? colors.onAccent : colors.ink} />
  ) : (
    <Text style={[styles.text, { color: isPrimary ? colors.onAccent : colors.ink }]}>
      {title}
    </Text>
  );

  let surface;
  if (isPrimary) {
    // Shadow and rounded-corner clipping can't safely share one layer
    // (overflow: 'hidden' clips the shadow unpredictably), so the shadow
    // lives on a plain outer wrapper and the clipping/gradient on the
    // layer inside it.
    surface = (
      <View style={styles.primaryShadowWrap}>
        <LinearGradient
          colors={[colors.accentStrong, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.base}
        >
          <View style={styles.primarySheen} pointerEvents="none" />
          {label}
        </LinearGradient>
      </View>
    );
  } else if (variant === 'outline') {
    surface = (
      <GlassSurface radius={radius.field} style={{ opacity: off ? 0.5 : 1 }}>
        <View style={styles.base}>{label}</View>
      </GlassSurface>
    );
  } else {
    surface = (
      <View style={[styles.base, styles.ghost, { opacity: off ? 0.5 : 1 }]}>{label}</View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      scaleTo={0.95}
      tiltDeg={2}
      style={style}
      animatedStyle={isPrimary && off ? { opacity: 0.45 } : undefined}
    >
      {surface}
    </AnimatedPressable>
  );
}

const getStyles = (colors, fonts, radius) =>
  StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: radius.field,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      overflow: 'hidden',
    },
    ghost: { backgroundColor: 'transparent' },
    primarySheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '55%',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderTopLeftRadius: radius.field,
      borderTopRightRadius: radius.field,
    },
    primaryShadowWrap: {
      borderRadius: radius.field,
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    text: { fontFamily: fonts.monoBold, fontSize: 14 },
  });
