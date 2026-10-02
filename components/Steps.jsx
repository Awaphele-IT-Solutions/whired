import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../lib/ThemeContext';

// Checkpoint row: filled accent nodes are done, the next one is ringed.
export default function Steps({ total = 3, done = 0 }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const isNext = i === done;
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: i <= done ? colors.accent : colors.line,
                }}
              />
            ) : null}
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDone ? colors.accent : 'transparent',
                borderWidth: isDone ? 0 : 1.5,
                borderColor: isNext ? colors.accent : colors.faint,
              }}
            >
              {isDone ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.onAccent,
                  }}
                />
              ) : null}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}
