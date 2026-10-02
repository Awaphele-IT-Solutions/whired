import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../lib/ThemeContext';

// Halftone backdrop modeled on the reference video: a square grid of orange
// dots where most dots are large and bright, and soft dark patches open up,
// morph and close again in place. Nothing slides across the screen. The
// field is a set of standing waves that swell and fade at different rates
// (loop harmonics 2 to 5), and multiplying two of them gives the irregular,
// blobby patches. Every term uses a whole-number multiple of the loop phase,
// so the cycle repeats seamlessly. Each dot's scale/opacity curve is
// pre-sampled at mount and driven natively, with no per-frame JS work.
const TARGET_DOTS = 550;
const SAMPLES = 60; // highest harmonic is 5, so this is 12 keyframes per period
const CYCLE_MS = 9000;
const MIN_SCALE = 0;
const MAX_SCALE = 1.5;
const MIN_OPACITY = 0;
const MAX_OPACITY = 0.7;
const DOT_BASE = 7;
const TAU = Math.PI * 2;

// Dot color per mode. Change these two values to recolor the dots.
const DOT_COLOR_DARK = '#290c05';
const DOT_COLOR_LIGHT = '#e4cfca';

// Smoothstep: dots stay full-size across most of the field and fall away
// quickly at the edge of a dark patch.
const smooth = (v) => v * v * (3 - 2 * v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default function AnimatedDotField() {
  const { isDark } = useTheme();
  const dotColor = isDark ? DOT_COLOR_DARK : DOT_COLOR_LIGHT;
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.linear, // the field itself carries the motion
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const dots = useMemo(() => {
    const area = Math.max(1, width * height);
    const spacing = Math.max(14, Math.sqrt(area / TARGET_DOTS));
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;
    const sampleTimes = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);
    const list = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * spacing;
        const y = row * spacing;

        const scaleRange = [];
        const opacityRange = [];

        sampleTimes.forEach((sample) => {
          const p = sample * TAU;

          // Standing waves at different angles, each breathing at its own rate.
          const a = Math.sin(x * 0.021 + 2 * p);
          const b = Math.sin(y * 0.017 - 3 * p + 1.0);
          const c = Math.sin((x + y) * 0.012 + 4 * p + 2.0);
          const d = Math.sin((x - 1.3 * y) * 0.015 - 5 * p + 0.5);
          // Product term: this is what makes irregular blobs, not stripes.
          const blobs = Math.sin(x * 0.013 + 2 * p + 0.7) * Math.sin(y * 0.015 - 3 * p + 2.4);

          const raw = 0.55 + 0.14 * a + 0.12 * b + 0.12 * c + 0.1 * d + 0.3 * blobs;
          const v = smooth(clamp01((raw - 0.15) / 0.5));

          scaleRange.push(MIN_SCALE + (MAX_SCALE - MIN_SCALE) * v);
          opacityRange.push(MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * v);
        });

        list.push({
          key: `${row}-${col}`,
          x,
          y,
          scale: t.interpolate({ inputRange: sampleTimes, outputRange: scaleRange }),
          opacity: t.interpolate({ inputRange: sampleTimes, outputRange: opacityRange }),
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d) => (
        <Animated.View
          key={d.key}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: DOT_BASE,
            height: DOT_BASE,
            borderRadius: DOT_BASE / 2,
            backgroundColor: dotColor,
            opacity: d.opacity,
            transform: [{ scale: d.scale }],
          }}
        />
      ))}
    </View>
  );
}