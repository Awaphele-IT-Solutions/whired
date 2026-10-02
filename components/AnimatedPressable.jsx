import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

// Shared tactile press animation used by Button, Tile, Chip and the tab bar:
// a quick spring scale-down plus a slight 3D tilt, so interactive surfaces
// feel like they're physically pressed into the glass rather than just
// dimming. Wrap any content in it; it forwards Pressable's props/state.
export default function AnimatedPressable({
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.96,
  tiltDeg = 1.5,
  style,
  animatedStyle,
  children,
  ...rest
}) {
  const progress = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue) => {
    Animated.spring(progress, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start();
  };

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, scaleTo],
  });
  const rotateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${tiltDeg}deg`],
  });

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) animateTo(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(0);
        onPressOut?.(e);
      }}
      style={style}
      {...rest}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            transform: [
              { perspective: 800 },
              { scale },
              { rotateX },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
