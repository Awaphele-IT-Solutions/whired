import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import DotRing from '../../components/dot/DotRing';
import DotText from '../../components/dot/DotText';
import Tile from '../../components/Tile';
import { useTheme } from '../../lib/ThemeContext';
import { STATUS_LABEL, getAdminStyles, fmt } from './common';

const LEVEL_LABEL = { critical: 'Critical', warn: 'Warning', info: 'Note' };

function Stat({ label, value }) {
  const { colors, fonts } = useTheme();
  const styles = getStyles(colors, fonts);
  return (
    <Tile label={label} style={styles.stat}>
      <DotText text={String(value)} dot={3} gap={1.5} />
    </Tile>
  );
}

export default function Overview({ data }) {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts);
  const s = getAdminStyles(colors, fonts, radius);
  const { capacity, stats, warnings, providers } = data;
  const used = capacity.rpd_capacity ? capacity.rpd_used / capacity.rpd_capacity : 0;

  return (
    <View>
      <Tile index="01" label="AI capacity today" style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <DotRing size={104} count={44} progress={used} dot={3}>
            {capacity.headroom_pct === null ? (
              <Text style={s.small}>no limits</Text>
            ) : (
              <DotText text={capacity.headroom_pct + '%'} dot={2.5} gap={1.2} />
            )}
          </DotRing>
          <View style={{ flex: 1 }}>
            {capacity.rpd_capacity === null ? (
              <Text style={s.small}>
                Set a daily request limit on your providers to see capacity and
                headroom here.
              </Text>
            ) : (
              <>
                <Text style={s.strong}>
                  {fmt(capacity.rpd_used)} of {fmt(capacity.rpd_capacity)}
                </Text>
                <Text style={[s.small, { marginTop: 4 }]}>daily requests used</Text>
                <Text style={[s.small, { marginTop: 10 }]}>
                  About {fmt(capacity.est_daily_users)} active users a day at{' '}
                  {capacity.avg_calls_per_active_user} calls each.
                </Text>
              </>
            )}
          </View>
        </View>
      </Tile>

      <View style={styles.grid}>
        <Stat label="Users" value={fmt(stats.users_total)} />
        <Stat label="Paid" value={fmt(stats.users_paid)} />
        <Stat label="AI calls today" value={fmt(stats.ai_calls_today)} />
        <Stat label="Research this month" value={fmt(stats.research_this_month)} />
      </View>

      <Tile index="02" label="Health" style={{ marginVertical: 12 }}>
        {warnings.length === 0 ? (
          <Text style={s.body}>All clear. No warnings right now.</Text>
        ) : (
          warnings.map((w, i) => (
            <View key={i} style={[styles.warning, i > 0 && { marginTop: 12 }]}>
              <View
                style={[
                  styles.marker,
                  w.level === 'critical' && { backgroundColor: colors.accent },
                  w.level === 'warn' && { borderWidth: 1.5, borderColor: colors.accent },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.level}>{LEVEL_LABEL[w.level]}</Text>
                <Text style={s.body}>{w.text}</Text>
              </View>
            </View>
          ))
        )}
      </Tile>

      <Tile index="03" label="Providers">
        {providers.length === 0 ? (
          <Text style={s.body}>No providers yet. Add one under AI providers.</Text>
        ) : (
          providers.map((p, i) => (
            <View key={p.id} style={[s.row, { marginBottom: i === providers.length - 1 ? 0 : 12 }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.strong} numberOfLines={1}>
                  {p.label}
                </Text>
                <Text style={s.small}>
                  {fmt(p.load.rpd)} requests today, {fmt(p.load.errors_1h)} errors in the last hour
                </Text>
              </View>
              <View style={[s.pill, p.status !== 'ok' && s.pillMuted]}>
                <Text style={s.pillText}>{STATUS_LABEL[p.status]}</Text>
              </View>
            </View>
          ))
        )}
      </Tile>
    </View>
  );
}

const getStyles = (colors, fonts) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    stat: { width: '47.5%', minHeight: 96 },
    warning: { flexDirection: 'row', gap: 12 },
    marker: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: colors.dotOff },
    level: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.mute,
      marginBottom: 2,
    },
  });
