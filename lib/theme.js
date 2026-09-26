// Design tokens for w/hired: warm surfaces, one vermilion accent, dark and
// light palettes sharing the same shape. Everything visual reads from here,
// normally through the `useTheme()` hook in ./ThemeContext so it stays live
// when the person switches modes.

const dark = {
  mode: 'dark',
  bg: '#0B0B0A',
  bgAlt: '#111110',
  card: '#161615',
  cardRaised: '#1E1E1C',
  field: '#0F0F0E',
  line: '#2B2A28',
  dotOff: '#33312E',
  ink: '#F1EEE8',
  mute: '#8E8A83',
  faint: '#5B5852',
  accent: '#FF4B1F',
  accentSoft: 'rgba(255, 75, 31, 0.14)',
  accentStrong: '#FF6B3D',
  onAccent: '#0B0B0A',
  danger: '#FF6B5B',
  // Glassmorphism tokens: frosted fill, hairline border, top sheen.
  glassTint: 'dark',
  glassFill: 'rgba(28, 27, 25, 0.52)',
  glassBorder: 'rgba(241, 238, 232, 0.10)',
  glassHighlight: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)'],
  glassSpecular: 'rgba(255,255,255,0.06)',
  // Elevation / depth.
  shadowColor: '#000000',
  shadowOpacity: 0.5,
  overlay: 'rgba(5, 5, 4, 0.65)',
};

const light = {
  mode: 'light',
  bg: '#F4F1EA',
  bgAlt: '#ECE8DD',
  card: '#FFFFFF',
  cardRaised: '#FBF9F4',
  field: '#FFFFFF',
  line: '#E3DDCF',
  dotOff: '#DAD3C2',
  ink: '#1A1815',
  mute: '#726C60',
  faint: '#A39C8B',
  accent: '#FF4B1F',
  accentSoft: 'rgba(255, 75, 31, 0.10)',
  accentStrong: '#E63E14',
  onAccent: '#FFFFFF',
  danger: '#D8402A',
  glassTint: 'light',
  glassFill: 'rgba(255, 255, 255, 0.55)',
  glassBorder: 'rgba(26, 24, 21, 0.08)',
  glassHighlight: ['rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'],
  glassSpecular: 'rgba(255,255,255,0.5)',
  shadowColor: '#1A1815',
  shadowOpacity: 0.14,
  overlay: 'rgba(244, 241, 234, 0.7)',
};

export const palettes = { dark, light };

export const fonts = {
  mono: 'SpaceMonoRegular',
  monoBold: 'SpaceMonoBold',
};

export const radius = {
  card: 22,
  field: 14,
  pill: 999,
};

// Type scale depends on the active palette (label/body/etc pick up `ink` /
// `mute`), so it's built per-palette rather than exported as one static
// object.
export function getType(colors) {
  return {
    label: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.mute,
    },
    body: {
      fontFamily: fonts.mono,
      fontSize: 14,
      lineHeight: 22,
      color: colors.ink,
    },
    small: {
      fontFamily: fonts.mono,
      fontSize: 12,
      lineHeight: 18,
      color: colors.mute,
    },
    title: {
      fontFamily: fonts.monoBold,
      fontSize: 20,
      lineHeight: 28,
      color: colors.ink,
    },
  };
}

// Back-compat static exports (dark palette) for any code path that runs
// before the ThemeProvider mounts. Prefer useTheme() everywhere else.
export const colors = dark;
export const type = getType(dark);
