import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../lib/theme';

// A dashboard card: numbered header line, then free-form content.
export default function Tile({
  index,
  label,
  right,
  onPress,
  style,
  children,
  accessibilityLabel,
}) {
  const inner = (
    <>
      <View style={styles.head}>
        {index ? <Text style={styles.index}>{index}</Text> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, style]}>{inner}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: colors.cardRaised,
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
