import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../lib/ThemeContext';
import AnimatedPressable from './AnimatedPressable';
import GlassSurface from './GlassSurface';

// A dashboard card: numbered header line, then free-form content, built on
// the shared glass surface (frosted fill, hairline border, top sheen,
// lifted shadow) so every tile reads as a lit, slightly raised pane. When
// pressable it also gets the shared 3D press animation.
export default function Tile({
  index,
  label,
  right,
  onPress,
  style,
  children,
  accessibilityLabel,
}) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts, radius);

  const inner = (
    <View style={styles.pad}>
      <View style={styles.head}>
        {index ? <Text style={styles.index}>{index}</Text> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );

  if (!onPress) {
    return (
      <GlassSurface style={style}>
        {inner}
      </GlassSurface>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      scaleTo={0.985}
      tiltDeg={0.6}
    >
      <GlassSurface style={style}>{inner}</GlassSurface>
    </AnimatedPressable>
  );
}

const getStyles = (colors, fonts, radius) =>
  StyleSheet.create({
    pad: {
      padding: 16,
      flex: 1,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    index: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      color: colors.ink,
      letterSpacing: 1,
    },
    label: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.mute,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      flexShrink: 1,
    },
    body: {
      flex: 1,
      marginTop: 12,
    },
  });
