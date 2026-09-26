import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import Tile from '../../components/Tile';
import { adminCall } from '../../lib/admin';
import { useTheme } from '../../lib/ThemeContext';
import { getAdminStyles } from './common';

export default function Audit() {
  const { colors, fonts, radius } = useTheme();
  const s = getAdminStyles(colors, fonts, radius);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminCall('audit', { limit: 50 })
      .then((r) => setEntries(r.entries))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Text style={s.error}>{error}</Text>;
  if (!entries) return <Text style={s.small}>Loading...</Text>;
  if (!entries.length) return <Text style={s.body}>Nothing has been changed yet.</Text>;

  return (
    <View>
      <Text style={[s.small, { marginBottom: 16 }]}>
        Every admin change is recorded here. API keys are never written to this log.
      </Text>
      {entries.map((e) => (
        <Tile key={e.id} label={new Date(e.created_at).toLocaleString()} style={{ marginBottom: 10 }}>
          <Text style={s.strong}>{e.action.replace(/_/g, ' ')}</Text>
          <Text style={[s.small, { marginTop: 4 }]}>
            by {String(e.admin_id ?? 'unknown').slice(0, 8)}
            {e.target ? `, target ${String(e.target).slice(0, 8)}` : ''}
          </Text>
          {Object.keys(e.details ?? {}).length ? (
            <Text style={[s.small, { marginTop: 6 }]} numberOfLines={4}>
              {JSON.stringify(e.details)}
            </Text>
          ) : null}
        </Tile>
      ))}
    </View>
  );
}
