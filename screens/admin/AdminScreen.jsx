import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Chip from '../../components/Chip';
import DotText from '../../components/dot/DotText';
import Screen from '../../components/Screen';
import { adminCall } from '../../lib/admin';
import { colors, fonts } from '../../lib/theme';
import AdminGate from './AdminGate';
import Audit from './Audit';
import Overview from './Overview';
import Plans from './Plans';
import Providers from './Providers';
import Users from './Users';
import { adminStyles as s } from './common';

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'providers', label: 'AI providers' },
  { key: 'plans', label: 'Plans' },
  { key: 'users', label: 'Users' },
  { key: 'audit', label: 'Audit' },
];

function Console({ navigation, reverify }) {
  const [section, setSection] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

const load = useCallback(async () => {
  try {
    setData(await adminCall('overview'));
    setError(null);
  } catch (e) {
    setError(JSON.stringify(e.detail));
  }
}, [navigation, reverify]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // keep limits and health fresh
    return () => clearInterval(t);
  }, [load]);

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.link}>Close</Text>
        </Pressable>
        <Pressable onPress={load} accessibilityRole="button">
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      <DotText text="ADMIN" dot={5} gap={2} />

      <View style={[s.chips, { marginTop: 22 }]}>
        {SECTIONS.map((x) => (
          <Chip key={x.key} label={x.label} selected={section === x.key} onPress={() => setSection(x.key)} />
        ))}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}
      {!data && !error ? <Text style={s.small}>Loading...</Text> : null}

      {data && section === 'overview' ? <Overview data={data} /> : null}
      {data && section === 'providers' ? <Providers data={data} reload={load} /> : null}
      {data && section === 'plans' ? <Plans data={data} reload={load} /> : null}
      {data && section === 'users' ? <Users plans={data.plans} /> : null}
      {section === 'audit' ? <Audit /> : null}
    </Screen>
  );
}

export default function AdminScreen({ navigation }) {
  return (
    <AdminGate onExit={() => navigation.goBack()}>
      {({ reverify }) => <Console navigation={navigation} reverify={reverify} />}
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  link: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },
});
