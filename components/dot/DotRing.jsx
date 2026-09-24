import React, { memo, useMemo } from 'react';
import { View } from 'react-native';

import { colors } from '../../lib/theme';

// A ring of dots that fills clockwise from the top. The last few lit dots
// use the accent colour, like the leading edge of a progress arc.
function DotRing({
  size = 120,
  count = 56,
  progress = 0,
  dot = 3,
  color = colors.ink,
  accent = colors.accent,
  accentTail = 3,
  children,
}) {
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const lit = Math.round(clamped * count);

  const points = useMemo(() => {
    const r = (size - dot) / 2;
    const c = size / 2;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      return {
        i,
        x: c + r * Math.cos(a) - dot / 2,
        y: c + r * Math.sin(a) - dot / 2,
      };
    });
  }, [size, count, dot]);

  return (
    <View style={{ width: size, height: size }}>
      {points.map((p) => {
        let bg = colors.dotOff;
        if (p.i < lit) bg = p.i >= lit - accentTail ? accent : color;
        return (
          <View
            key={p.i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: bg,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default memo(DotRing);
