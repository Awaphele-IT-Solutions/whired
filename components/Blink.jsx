import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text } from 'react-native';

import { colors, fonts } from '../lib/theme';

// A blinking terminal-style cursor.
export default function Blink({ char = '_', size = 12, color = colors.accent }) {
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
      style={{ opacity, color, fontFamily: fonts.monoBold, fontSize: size }}
    >
      {char}
    </Animated.Text>
  );
}
