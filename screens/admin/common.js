import { StyleSheet } from 'react-native';

export const fmt = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString());

// Admin screens are internal tooling, but still theme-aware: call this with
// the live palette from useTheme() rather than importing static colors.
export const getAdminStyles = (colors, fonts, radius) =>
  StyleSheet.create({
    body: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, color: colors.ink },
    small: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 17, color: colors.mute },
    strong: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
    heading: { fontFamily: fonts.monoBold, fontSize: 16, color: colors.ink, marginBottom: 14 },
    error: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.accent, marginBottom: 14 },
    label: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.mute,
      marginBottom: 10,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    pill: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    pillMuted: { borderColor: colors.faint },
    pillText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.ink },
  });

export const STATUS_LABEL = {
  ok: 'Healthy',
  off: 'Off',
  no_key: 'No key',
  cooldown: 'Cooling down',
  limit: 'At limit',
};
