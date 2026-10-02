import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../lib/ThemeContext';

export default function Field({ label, hint, multiline, style, inputStyle, ...rest }) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts, radius);
  const glow = useRef(new Animated.Value(0)).current;

  const animateFocus = (toValue) => {
    Animated.timing(glow, { toValue, duration: 160, useNativeDriver: false }).start();
  };

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, colors.accent],
  });

  return (
    <View style={[{ marginBottom: 18 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.inputWrap, multiline && styles.multiline, { borderColor }]}>
        <TextInput
          {...rest}
          multiline={multiline}
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          onFocus={(e) => {
            animateFocus(1);
            rest.onFocus && rest.onFocus(e);
          }}
          onBlur={(e) => {
            animateFocus(0);
            rest.onBlur && rest.onBlur(e);
          }}
          style={[styles.input, multiline && styles.multilineInput, inputStyle]}
        />
      </Animated.View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const getStyles = (colors, fonts, radius) =>
  StyleSheet.create({
    label: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.mute,
      marginBottom: 8,
    },
    inputWrap: {
      minHeight: 52,
      borderWidth: 1.5,
      borderRadius: radius.field,
      backgroundColor: colors.field,
      justifyContent: 'center',
    },
    multiline: {
      minHeight: 120,
    },
    input: {
      color: colors.ink,
      paddingHorizontal: 16,
      fontFamily: fonts.mono,
      fontSize: 14,
    },
    multilineInput: {
      minHeight: 120,
      paddingTop: 14,
      paddingBottom: 14,
      textAlignVertical: 'top',
      lineHeight: 21,
    },
    hint: {
      fontFamily: fonts.mono,
      fontSize: 11,
      lineHeight: 16,
      color: colors.faint,
      marginTop: 6,
    },
  });
