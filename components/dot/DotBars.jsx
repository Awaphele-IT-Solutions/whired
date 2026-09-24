import React, { memo } from 'react';
import { View } from 'react-native';

import { colors } from '../../lib/theme';

// Columns of dots. `values` are 0..1. Bars grow from the bottom, or from the
// centre when `mirror` is set (waveform look). The last `accentLast` columns
// are drawn in the accent colour.
function DotBars({
  values = [],
  rows = 7,
  dot = 4,
  gap = 3,
  color = colors.ink,
  accent = colors.accent,
  accentLast = 1,
  mirror = false,
}) {
  const total = mirror && rows % 2 === 0 ? rows + 1 : rows;
  const mid = (total - 1) / 2;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {values.map((raw, ci) => {
        const v = Math.max(0, Math.min(1, raw || 0));
        const isAccent = ci >= values.length - accentLast;
        const lit = mirror
          ? Math.round(v * mid)
          : Math.round(v * total);
        return (
          <View
            key={ci}
            style={{ marginLeft: ci === 0 ? 0 : gap }}
          >
            {Array.from({ length: total }, (_, r) => {
              const on = mirror
                ? Math.abs(r - mid) <= lit
                : r >= total - lit;
              return (
                <View
                  key={r}
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: dot / 2,
                    marginTop: r === 0 ? 0 : gap,
                    backgroundColor: on
                      ? isAccent
                        ? accent
                        : color
                      : colors.dotOff,
                  }}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export default memo(DotBars);
