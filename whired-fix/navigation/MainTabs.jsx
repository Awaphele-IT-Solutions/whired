import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '../lib/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import MockScreen from '../screens/MockScreen';
import ResearchScreen from '../screens/ResearchScreen';
import StoriesScreen from '../screens/StoriesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnimatedDotField from '../components/AnimatedDotField';
import { BackdropContext } from '../components/BackdropContext';
import TabBar from './TabBar';
import { TabsContext } from './tabs';

const TABS = [
  { key: 'home', label: 'Home', Component: HomeScreen },
  { key: 'research', label: 'Research', Component: ResearchScreen },
  { key: 'mock', label: 'Mock', Component: MockScreen },
  { key: 'stories', label: 'Stories', Component: StoriesScreen },
  { key: 'you', label: 'You', Component: ProfileScreen },
];

// Tabs stay mounted once visited (hidden, not unmounted) so a mock interview
// in progress survives a trip to another tab. Switching tabs cross-fades
// with a small slide instead of an instant cut.
export default function MainTabs() {
  const { colors } = useTheme();
  const [active, setActive] = useState('home');
  const [params, setParams] = useState({});
  const [visited, setVisited] = useState({ home: true });

  const goTo = useCallback((key, nextParams = {}) => {
    setParams(nextParams);
    setActive(key);
    setVisited((v) => (v[key] ? v : { ...v, [key]: true }));
  }, []);

  const ctx = useMemo(() => ({ active, params, goTo }), [active, params, goTo]);

  return (
    <TabsContext.Provider value={ctx}>
      <BackdropContext.Provider value={true}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AnimatedDotField />
        <View style={{ flex: 1 }}>
          {TABS.map(({ key, Component }) =>
            visited[key] ? (
              <TabPane key={key} visible={key === active}>
                <Component />
              </TabPane>
            ) : null
          )}
        </View>
        <TabBar tabs={TABS} active={active} onChange={(key) => goTo(key, {})} />
      </View>
      </BackdropContext.Provider>
    </TabsContext.Provider>
  );
}

function TabPane({ visible, children }) {
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mountedVisible, setMountedVisible] = useState(visible);

  useEffect(() => {
    if (visible) setMountedVisible(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMountedVisible(false);
    });
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
            },
          ],
          display: mountedVisible ? 'flex' : 'none',
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
