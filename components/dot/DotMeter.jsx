import React, { memo } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../lib/ThemeContext';

// A single row of dots showing a 0..100 value.
function DotMeter({
  value = 0,
  count = 10,
  dot = 5,
  gap = 3,
  color,
  accent,
}) {
  const { colors } = useTheme();
  const dotColor = color ?? colors.ink;
  const dotAccent = accent ?? colors.accent;
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * count);
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            marginLeft: i === 0 ? 0 : gap,
            backgroundColor:
              i < lit ? (i === lit - 1 ? dotAccent : dotColor) : colors.dotOff,
          }}
        />
      ))}
    </View>
  );
}

export default memo(DotMeter);
