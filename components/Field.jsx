import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '../lib/theme';

export default function Field({ label, hint, multiline, style, inputStyle, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 18 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus && rest.onFocus(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur && rest.onBlur(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          inputStyle,
        ]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.mute,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.field,
    backgroundColor: colors.field,
    color: colors.ink,
    paddingHorizontal: 16,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  multiline: {
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
    lineHeight: 21,
  },
  focused: { borderColor: colors.accent },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.faint,
    marginTop: 6,
  },
});
