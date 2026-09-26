import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Chip from '../../components/Chip';
import Tile from '../../components/Tile';
import { adminCall } from '../../lib/admin';
import { useTheme } from '../../lib/ThemeContext';
import { getAdminStyles, fmt } from './common';

function timeAgo(iso) {
  if (!iso) return '';
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function Stat({ label, value, warn }) {
  const { colors, fonts } = useTheme();
  const styles = getStyles(colors, fonts);
  return (
    <Tile label={label} style={styles.stat}>
      <Text style={[styles.statValue, warn && { color: colors.accent }]}>{fmt(value)}</Text>
    </Tile>
  );
}

export default function Errors() {
  const { colors, fonts, radius } = useTheme();
  const styles = getStyles(colors, fonts);
  const s = getAdminStyles(colors, fonts, radius);
  const [calls, setCalls] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [errorsOnly, setErrorsOnly] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await adminCall('recent_calls', { limit: 50, errors_only: errorsOnly });
      setCalls(res.calls ?? []);
      setMetrics(res.metrics ?? null);
      setError(null);
    } catch (e) {
      setError(e.detail?.message || e.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [errorsOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      <View style={styles.grid}>
        <Stat label="Errors (1h)" value={metrics?.errors_1h} warn={metrics?.errors_1h > 0} />
        <Stat label="Errors (24h)" value={metrics?.errors_24h} warn={metrics?.errors_24h > 0} />
        <Stat label="OK (24h)" value={metrics?.ok_24h} />
      </View>

      <View style={[s.chips, { marginTop: 4 }]}>
        <Chip label="Errors only" selected={errorsOnly} onPress={() => setErrorsOnly(true)} />
        <Chip label="All calls" selected={!errorsOnly} onPress={() => setErrorsOnly(false)} />
        <Pressable onPress={load} disabled={busy} accessibilityRole="button">
          <Text style={[styles.refresh, busy && { opacity: 0.5 }]}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {!calls && !error ? <Text style={s.small}>Loading...</Text> : null}

      {calls && calls.length === 0 ? (
        <Tile>
          <Text style={s.body}>
            {errorsOnly ? 'No errors in the recent window. All clear.' : 'No provider calls logged yet.'}
          </Text>
        </Tile>
      ) : null}

      {calls?.map((c) => (
        <Tile key={c.id} style={styles.card}>
          <View style={s.row}>
            <Text style={s.strong} numberOfLines={1}>
              {c.provider_label || 'Unknown'}
            </Text>
            <View style={[s.pill, c.status === 'ok' ? null : s.pillMuted]}>
              <Text style={s.pillText}>{c.status}</Text>
            </View>
          </View>
          <Text style={s.small}>
            {c.purpose} · {timeAgo(c.created_at)}
            {c.latency_ms != null ? ` · ${c.latency_ms}ms` : ''}
            {c.http_status ? ` · HTTP ${c.http_status}` : ''}
          </Text>
          {c.error ? <Text style={[s.body, { color: colors.accent, marginTop: 8 }]}>{c.error}</Text> : null}
          {(c.tokens_in != null || c.tokens_out != null) && (
            <Text style={[s.small, { marginTop: 6 }]}>
              tokens in {fmt(c.tokens_in)} · out {fmt(c.tokens_out)}
            </Text>
          )}
        </Tile>
      ))}
    </View>
  );
}

const getStyles = (colors, fonts) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    stat: { width: '31%', minWidth: 100, flexGrow: 1 },
    statValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.ink },
    refresh: {
      fontFamily: fonts.monoBold,
      fontSize: 12,
      color: colors.accent,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    card: { marginBottom: 10 },
  });
