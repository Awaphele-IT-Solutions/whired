import React, { memo, useMemo } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../lib/ThemeContext';
import { GLYPHS } from './glyphs';

// Size of a rendered string, so callers can lay things out around it.
export function measureDotText(text, dot = 3, gap = 1.5) {
  const pitch = dot + gap;
  const n = String(text).length;
  return {
    pitch,
    width: n > 0 ? (6 * n - 1) * pitch - gap : 0,
    height: 7 * pitch - gap,
  };
}

// Text drawn as lit dots on a 5x7 grid. Characters listed in `accentChars`
// are drawn in the accent colour (e.g. the slash in "W/HIRED").
function DotText({
  text,
  dot = 3,
  gap = 1.5,
  color,
  accent,
  accentChars = '',
  ghost = false,
  style,
}) {
  const { colors } = useTheme();
  const dotColor = color ?? colors.ink;
  const dotAccent = accent ?? colors.accent;
  const value = String(text).toUpperCase();
  const { width, height, pitch } = measureDotText(value, dot, gap);

  const dots = useMemo(() => {
    const out = [];
    Array.from(value).forEach((ch, ci) => {
      const glyph = GLYPHS[ch] || GLYPHS['?'];
      const isAccent = accentChars.includes(ch);
      glyph.forEach((row, r) => {
        for (let c = 0; c < 5; c++) {
          const on = row[c] === '1';
          if (!on && !ghost) continue;
          out.push({
            key: ci + '-' + r + '-' + c,
            left: (ci * 6 + c) * pitch,
            top: r * pitch,
            on,
            isAccent,
          });
        }
      });
    });
    return out;
  }, [value, pitch, ghost, accentChars]);

  return (
    <View
      style={[{ width, height }, style]}
      accessible
      accessibilityLabel={String(text)}
    >
      {dots.map((d) => (
        <View
          key={d.key}
          style={{
            position: 'absolute',
            left: d.left,
            top: d.top,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: d.on
              ? d.isAccent
                ? dotAccent
                : dotColor
              : colors.dotOff,
          }}
        />
      ))}
    </View>
  );
}

export default memo(DotText);
