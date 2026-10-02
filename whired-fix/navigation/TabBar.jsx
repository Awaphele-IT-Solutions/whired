import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../lib/ThemeContext';
import GlassSurface from '../components/GlassSurface';

// Frosted glass tab bar with a spring-driven accent line that glides under
// whichever tab is active, plus a per-tab press/select animation.
export default function TabBar({ tabs, active, onChange }) {
  const { colors, fonts } = useTheme();
  const styles = getStyles(colors, fonts);
  const insets = useSafeAreaInsets();
  const index = Math.max(0, tabs.findIndex((t) => t.key === active));
  const indicator = useRef(new Animated.Value(index)).current;
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth / Math.max(1, tabs.length);

  useEffect(() => {
    Animated.spring(indicator, {
      toValue: index,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [index, indicator]);

  return (
    <View style={styles.wrap}>
      <GlassSurface radius={0} elevated={false} blur style={styles.glass}>
        <View
          style={[styles.bar, { paddingBottom: Math.max(insets.bottom - 12, 10) }]}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          {barWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  width: tabWidth,
                  transform: [
                    {
                      translateX: indicator.interpolate({
                        inputRange: tabs.map((_, i) => i),
                        outputRange: tabs.map((_, i) => i * tabWidth),
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.indicatorLine} />
            </Animated.View>
          ) : null}
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              tab={tab}
              focused={tab.key === active}
              onPress={() => onChange(tab.key)}
              styles={styles}
            />
          ))}
        </View>
      </GlassSurface>
    </View>
  );
}

function Tab({ tab, focused, onPress, styles }) {
  const select = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(select, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [focused, select]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
      style={styles.tab}
      onPressIn={() =>
        Animated.spring(press, { toValue: 0.85, useNativeDriver: true, speed: 40 }).start()
      }
      onPressOut={() =>
        Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40 }).start()
      }
    >
      <Animated.View
        style={{
          transform: [
            { scale: press },
            { scale: select.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
          ],
        }}
      >
        <View style={[styles.dot, focused && styles.dotOn]} />
      </Animated.View>
      <Animated.Text
        style={[
          styles.label,
          focused && styles.labelOn,
          { opacity: select.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) },
        ]}
      >
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}

const getStyles = (colors, fonts) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    glass: { borderRadius: 0 },
    bar: {
      flexDirection: 'row',
      paddingTop: 10,
    },
    indicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: 2,
      alignItems: 'center',
    },
    indicatorLine: {
      width: 24,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.accent,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.dotOff,
    },
    dotOn: { backgroundColor: colors.accent },
    label: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.faint,
    },
    labelOn: { color: colors.ink },
  });
