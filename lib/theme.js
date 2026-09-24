// Design tokens for w/hired: near-black warm surfaces, warm-white lit dots,
// one vermilion accent. Everything visual reads from here.

export const colors = {
  bg: '#0B0B0A',
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
  onAccent: '#0B0B0A',
};

export const fonts = {
  mono: 'SpaceMonoRegular',
  monoBold: 'SpaceMonoBold',
};

export const radius = {
  card: 22,
  field: 14,
  pill: 999,
};

export const type = {
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
