import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { colors } from '../lib/theme';
import HomeScreen from '../screens/HomeScreen';
import MockScreen from '../screens/MockScreen';
import ResearchScreen from '../screens/ResearchScreen';
import StoriesScreen from '../screens/StoriesScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
// in progress survives a trip to another tab.
export default function MainTabs() {
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
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          {TABS.map(({ key, Component }) =>
            visited[key] ? (
              <View
                key={key}
                style={{ flex: 1, display: key === active ? 'flex' : 'none' }}
              >
                <Component />
              </View>
            ) : null
          )}
        </View>
        <TabBar tabs={TABS} active={active} onChange={(key) => goTo(key, {})} />
      </View>
    </TabsContext.Provider>
  );
}
