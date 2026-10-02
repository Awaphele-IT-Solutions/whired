import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../lib/ThemeContext';

// Halftone backdrop. The old version animated ~1100 dots individually (two
// native interpolations each, forever), which choked scrolling. This one lays
// the dots out ONCE as static views, sorted into a few diagonal bands, and
// animates only each band's opacity (BANDS animated nodes instead of ~2200).
// Each band is rasterised to a texture, so the GPU just fades a bitmap.
// Dot sizes come from a static wave field, so the dark "patches" are still
// there; they now breathe in soft diagonal waves rather than morphing.
const TARGET_DOTS = 700;
const BANDS = 6;
const CYCLE_MS = 9000;
const DOT_BASE = 7;
const TAU = Math.PI * 2;

const DOT_COLOR_DARK = '#290c05';
const DOT_COLOR_LIGHT = '#E63E14';

const smooth = (v) => v * v * (3 - 2 * v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const Band = memo(function Band({ dots, color }) {
  return (
    <>
      {dots.map((d) => (
        <View
          key={d.key}
          style={{
            position: 'absolute',
            left: d.x + (DOT_BASE - d.size) / 2,
            top: d.y + (DOT_BASE - d.size) / 2,
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
});

function AnimatedDotField({ paused = false }) {
  const { isDark } = useTheme();
  const dotColor = isDark ? DOT_COLOR_DARK : DOT_COLOR_LIGHT;
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (paused) return undefined;
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [t, paused]);

  const bands = useMemo(() => {
    const area = Math.max(1, width * height);
    const spacing = Math.max(18, Math.sqrt(area / TARGET_DOTS));
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;
    const diag = width + height;
    const groups = Array.from({ length: BANDS }, () => []);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * spacing;
        const y = row * spacing;
        const raw =
          0.55 +
          0.14 * Math.sin(x * 0.021) +
          0.12 * Math.sin(y * 0.017 + 1.0) +
          0.12 * Math.sin((x + y) * 0.012 + 2.0) +
          0.3 * Math.sin(x * 0.013 + 0.7) * Math.sin(y * 0.015 + 2.4);
        const v = smooth(clamp01((raw - 0.15) / 0.5));
        const size = DOT_BASE * 1.15 * v;
        if (size < 1.5) continue; // fully "dark" patch: draw nothing
        const band = Math.min(BANDS - 1, Math.floor(((x + y) / diag) * BANDS));
        groups[band].push({ key: `${row}-${col}`, x, y, size });
      }
    }

    // Each band fades at the same rate, phase-shifted along the diagonal, so
    // the pulse sweeps across the screen. Whole-number harmonic = seamless loop.
    const samples = 24;
    const times = Array.from({ length: samples + 1 }, (_, i) => i / samples);
    return groups.map((dots, i) => ({
      dots,
      opacity: t.interpolate({
        inputRange: times,
        outputRange: times.map((s) => 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(s * TAU * 2 + (i / BANDS) * TAU))),
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bands.map((b, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFill, { opacity: b.opacity }]}
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
        >
          <Band dots={b.dots} color={dotColor} />
        </Animated.View>
      ))}
    </View>
  );
}

export default memo(AnimatedDotField);
