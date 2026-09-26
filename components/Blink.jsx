import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text } from 'react-native';

import { useTheme } from '../lib/ThemeContext';

// A blinking terminal-style cursor.
export default function Blink({ char = '_', size = 12, color }) {
  const { colors, fonts } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.Text
      style={{ opacity, color: resolvedColor, fontFamily: fonts.monoBold, fontSize: size }}
    >
      {char}
    </Animated.Text>
  );
}
