import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../lib/ThemeContext';
import AnimatedPressable from './AnimatedPressable';

export default function Chip({ label, selected, onPress }) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts, radius);
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      scaleTo={0.94}
      tiltDeg={1}
      animatedStyle={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </AnimatedPressable>
  );
}

const getStyles = (colors, fonts, radius) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    selected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    text: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
    textSelected: { color: colors.ink },
  });
