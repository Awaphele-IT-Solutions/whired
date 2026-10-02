import React, { memo, useMemo } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../lib/ThemeContext';

// A dotted line chart. The latest point gets an accent ring marker.
function DotLine({
  values = [],
  width = 200,
  height = 80,
  dot = 3,
  spacing = 7,
  color,
  accent,
}) {
  const { colors } = useTheme();
  const dotColor = color ?? colors.ink;
  const dotAccent = accent ?? colors.accent;
  const { dots, last } = useMemo(() => {
    const out = [];
    const n = values.length;
    const usableW = width - dot;
    const usableH = height - dot;

    if (n === 0) {
      for (let x = 0; x <= usableW; x += spacing) {
        out.push({ x, y: usableH / 2, on: false });
      }
      return { dots: out, last: null };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => ({
      x: n === 1 ? usableW / 2 : (i * usableW) / (n - 1),
      y: max === min ? usableH / 2 : usableH - ((v - min) / span) * usableH,
    }));

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(len / spacing));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          on: true,
        });
      }
    }
    const tail = pts[pts.length - 1];
    out.push({ x: tail.x, y: tail.y, on: true });
    return { dots: out, last: tail };
  }, [values, width, height, dot, spacing]);

  const ring = 14;

  return (
    <View style={{ width, height }}>
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: d.on ? dotColor : colors.dotOff,
          }}
        />
      ))}
      {last ? (
        <View
          style={{
            position: 'absolute',
            left: last.x + dot / 2 - ring / 2,
            top: last.y + dot / 2 - ring / 2,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 1.5,
            borderColor: dotAccent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: dotAccent,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export default memo(DotLine);
