import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import Button from '../../components/Button';
import Chip from '../../components/Chip';
import DotMeter from '../../components/dot/DotMeter';
import Field from '../../components/Field';
import Tile from '../../components/Tile';
import { adminCall } from '../../lib/admin';
import { colors, fonts } from '../../lib/theme';
import { STATUS_LABEL, adminStyles as s, fmt } from './common';

// Endpoints for common services. Model names are left for you to fill in so
// they never go stale in the app: use the exact model id from the provider.
const PRESETS = [
  { name: 'Groq', kind: 'openai_compatible', base_url: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
  { name: 'OpenAI', kind: 'openai_compatible', base_url: 'https://api.openai.com/v1', model: '' },
  { name: 'Gemini', kind: 'openai_compatible', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '' },
  { name: 'OpenRouter', kind: 'openai_compatible', base_url: 'https://openrouter.ai/api/v1', model: '' },
  { name: 'Anthropic', kind: 'anthropic', base_url: 'https://api.anthropic.com', model: '', web_search: true },
  { name: 'Tavily', kind: 'tavily', base_url: 'https://api.tavily.com', model: 'tavily-search', purposes: ['research'] },
  { name: 'Custom', kind: 'openai_compatible', base_url: '', model: '' },
];

const numOrBlank = (v) => (v === null || v === undefined ? '' : String(v));

function Toggle({ label, hint, value, onValueChange }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={s.row}>
        <Text style={[s.body, { flex: 1, paddingRight: 12 }]}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.dotOff, true: colors.accent }}
          thumbColor={colors.ink}
        />
      </View>
      {hint ? <Text style={[s.small, { marginTop: -8 }]}>{hint}</Text> : null}
    </View>
  );
}

function UsageRow({ label, used, limit }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <View style={styles.usage}>
      <Text style={styles.usageLabel}>{label}</Text>
      <DotMeter value={pct} count={10} dot={5} gap={3} />
      <Text style={styles.usageValue}>
        {fmt(used)}
        {limit ? ` / ${fmt(limit)}` : ''}
      </Text>
    </View>
  );
}

function ProviderForm({ initial, onDone, onCancel }) {
  const editing = !!initial;
  const [f, setF] = useState({
    label: initial?.label ?? '',
    kind: initial?.kind ?? 'openai_compatible',
    base_url: initial?.base_url ?? '',
    model: initial?.model ?? '',
    api_key: '',
    purposes: initial?.purposes ?? ['interview', 'research'],
    web_search: initial?.web_search ?? false,
    json_mode: initial?.json_mode ?? true,
    priority: String(initial?.priority ?? 100),
    rpm_limit: numOrBlank(initial?.rpm_limit),
    rpd_limit: numOrBlank(initial?.rpd_limit),
    tpd_limit: numOrBlank(initial?.tpd_limit),
    enabled: initial?.enabled ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const applyPreset = (p) =>
    set({
      label: f.label || (p.name === 'Custom' ? '' : p.name),
      kind: p.kind,
      base_url: p.base_url,
      model: p.model || f.model,
      web_search: !!p.web_search,
      purposes: p.purposes || f.purposes,
    });

  const togglePurpose = (key) =>
    set({ purposes: f.purposes.includes(key) ? f.purposes.filter((x) => x !== key) : [...f.purposes, key] });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminCall('provider_save', {
        provider: {
          id: initial?.id,
          label: f.label,
          kind: f.kind,
          base_url: f.base_url,
          model: f.model,
          api_key: f.api_key,
          purposes: f.purposes,
          web_search: f.web_search,
          json_mode: f.json_mode,
          priority: Number(f.priority) || 100,
          rpm_limit: f.rpm_limit,
          rpd_limit: f.rpd_limit,
          tpd_limit: f.tpd_limit,
          enabled: f.enabled,
        },
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (force) => {
    try {
      await adminCall('provider_delete', { id: initial.id, force });
      onDone();
    } catch (e) {
      if (e.code === 'last_provider') {
        Alert.alert(
          'This is your only provider',
          `Nothing else serves ${e.detail?.purpose}. Deleting it will make that feature fail until you add another.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete anyway', style: 'destructive', onPress: () => remove(true) },
          ]
        );
      } else setError(e.message);
    }
  };

  const confirmRemove = () =>
    Alert.alert(`Delete ${initial.label}?`, 'Its saved API key is deleted with it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(false) },
    ]);

  return (
    <View>
      <Text style={s.heading}>{editing ? `Edit ${initial.label}` : 'Add an AI provider'}</Text>

      {!editing ? (
        <>
          <Text style={s.label}>Start from</Text>
          <View style={s.chips}>
            {PRESETS.map((p) => (
              <Chip key={p.name} label={p.name} onPress={() => applyPreset(p)} />
            ))}
          </View>
        </>
      ) : null}

      <Field label="Label" value={f.label} onChangeText={(v) => set({ label: v })} placeholder="e.g. Groq main" />

      <Text style={s.label}>Type</Text>
      <View style={s.chips}>
        <Chip label="OpenAI-compatible" selected={f.kind === 'openai_compatible'} onPress={() => set({ kind: 'openai_compatible', web_search: false })} />
        <Chip label="Anthropic" selected={f.kind === 'anthropic'} onPress={() => set({ kind: 'anthropic' })} />
        <Chip label="Web search (Tavily)" selected={f.kind === 'tavily'} onPress={() => set({ kind: 'tavily', web_search: false, purposes: ['research'] })} />
      </View>

      <Field label="Base URL" value={f.base_url} onChangeText={(v) => set({ base_url: v })} placeholder="https://api.example.com/v1" autoCapitalize="none" autoCorrect={false} keyboardType="url" hint="HTTPS only. IP addresses and internal hosts are rejected." />
      {f.kind !== 'tavily' ? (
        <Field label="Model" value={f.model} onChangeText={(v) => set({ model: v })} placeholder="Exact model id from the provider" autoCapitalize="none" autoCorrect={false} />
      ) : (
        <Field label="Model" value={f.model} onChangeText={(v) => set({ model: v })} editable={false} hint="Not used for a search provider." />
      )}
      <Field
        label="API key"
        value={f.api_key}
        onChangeText={(v) => set({ api_key: v })}
        placeholder={editing && initial.has_key ? `Saved (ends ${initial.key_last4}). Leave blank to keep it.` : 'Paste the key'}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        hint="Encrypted on the server. It can't be viewed again after saving, only replaced."
      />

      <Text style={s.label}>Used for</Text>
      <View style={s.chips}>
        <Chip label="Mock interviews" selected={f.purposes.includes('interview')} onPress={() => togglePurpose('interview')} />
        <Chip label="Research" selected={f.purposes.includes('research')} onPress={() => togglePurpose('research')} />
      </View>

      {f.kind === 'anthropic' ? (
        <Toggle label="Use web search for research" hint="Needs web search enabled on your Anthropic account. Gives sourced research." value={f.web_search} onValueChange={(v) => set({ web_search: v })} />
      ) : f.kind === 'tavily' ? null : (
        <Toggle label="Ask for JSON mode" hint="Turn off if this provider or model rejects response_format." value={f.json_mode} onValueChange={(v) => set({ json_mode: v })} />
      )}

      <Field label="Priority" value={f.priority} onChangeText={(v) => set({ priority: v })} keyboardType="number-pad" hint="Lower numbers are tried first. Providers with the same priority share load by headroom." />

      <Text style={s.label}>Limits (blank = none)</Text>
      <Field value={f.rpd_limit} onChangeText={(v) => set({ rpd_limit: v })} placeholder="Requests per day" keyboardType="number-pad" style={{ marginBottom: 10 }} />
      <Field value={f.rpm_limit} onChangeText={(v) => set({ rpm_limit: v })} placeholder="Requests per minute" keyboardType="number-pad" style={{ marginBottom: 10 }} />
      <Field value={f.tpd_limit} onChangeText={(v) => set({ tpd_limit: v })} placeholder="Tokens per day" keyboardType="number-pad" hint="Set these a little below what your plan with the provider allows, so traffic moves to the next provider before the first one starts refusing." />

      <Toggle label="Enabled" value={f.enabled} onValueChange={(v) => set({ enabled: v })} />

      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title={editing ? 'Save changes' : 'Add provider'} onPress={save} loading={busy} style={{ marginBottom: 10 }} />
      {editing ? <Button title="Delete provider" variant="outline" onPress={confirmRemove} style={{ marginBottom: 10 }} /> : null}
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  );
}

export default function Providers({ data, reload }) {
  const [editing, setEditing] = useState(null); // null | 'new' | provider
  const [testing, setTesting] = useState(null);

  if (editing) {
    return (
      <ProviderForm
        initial={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const test = async (p) => {
    setTesting(p.id);
    try {
      const r = await adminCall('provider_test', { id: p.id });
      Alert.alert(
        r.ok ? `${p.label} works` : `${p.label} failed`,
        r.ok ? `Responded in ${r.latency_ms} ms.` : r.error
      );
    } catch (e) {
      Alert.alert('Test failed', e.message);
    } finally {
      setTesting(null);
      reload();
    }
  };

  const toggle = async (p, enabled) => {
    try {
      await adminCall('provider_save', {
        provider: {
          id: p.id, label: p.label, kind: p.kind, base_url: p.base_url, model: p.model,
          purposes: p.purposes, web_search: p.web_search, json_mode: p.json_mode, priority: p.priority,
          rpm_limit: p.rpm_limit, rpd_limit: p.rpd_limit, tpd_limit: p.tpd_limit, enabled,
        },
      });
    } catch (e) {
      Alert.alert("Couldn't update", e.message);
    }
    reload();
  };

  return (
    <View>
      <Text style={[s.small, { marginBottom: 16 }]}>
        Requests go to the lowest priority number first and fail over
        automatically if a provider is rate limited, down, or at a limit you set.
      </Text>
      <Button title="Add an AI provider" onPress={() => setEditing('new')} style={{ marginBottom: 18 }} />

      {data.providers.map((p, i) => {
        const limits = Object.entries(p.last_limits ?? {}).slice(0, 6);
        return (
          <Tile
            key={p.id}
            index={String(i + 1).padStart(2, '0')}
            label={p.label}
            style={{ marginBottom: 12 }}
            right={
              <View style={[s.pill, p.status !== 'ok' && s.pillMuted]}>
                <Text style={s.pillText}>{STATUS_LABEL[p.status]}</Text>
              </View>
            }
          >
            <Text style={s.small}>
              {p.kind === 'anthropic' ? 'Anthropic' : p.kind === 'tavily' ? 'Web search (Tavily)' : 'OpenAI-compatible'}
              {p.kind === 'tavily' ? '' : `, ${p.model}`}
            </Text>
            <Text style={[s.small, { marginTop: 2 }]}>
              Priority {p.priority}, {p.purposes.join(' and ')}
              {p.web_search ? ', web search' : ''}
              {p.has_key ? `, key ends ${p.key_last4}` : ', no key'}
            </Text>

            <View style={{ marginVertical: 14 }}>
              <UsageRow label="Req/day" used={p.load.rpd} limit={p.rpd_limit} />
              <UsageRow label="Req/min" used={p.load.rpm} limit={p.rpm_limit} />
              <UsageRow label="Tokens/day" used={p.load.tpd} limit={p.tpd_limit} />
            </View>

            {p.status === 'cooldown' ? (
              <Text style={[s.small, { color: colors.accent, marginBottom: 8 }]}>
                Skipped until {new Date(p.cooldown_until).toLocaleTimeString()}: {p.last_error}
              </Text>
            ) : p.last_error ? (
              <Text style={[s.small, { marginBottom: 8 }]}>Last error: {p.last_error}</Text>
            ) : null}

            {limits.length ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={[s.small, { color: colors.faint, marginBottom: 4 }]}>Reported by the provider</Text>
                {limits.map(([k, v]) => (
                  <Text key={k} style={styles.limitLine} numberOfLines={1}>
                    {k.replace(/^(x-)?ratelimit-?|^anthropic-ratelimit-/, '')}: {v}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={s.row}>
              <Text style={s.body}>Enabled</Text>
              <Switch
                value={p.enabled}
                onValueChange={(v) => toggle(p, v)}
                trackColor={{ false: colors.dotOff, true: colors.accent }}
                thumbColor={colors.ink}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Test" variant="outline" onPress={() => test(p)} loading={testing === p.id} style={{ flex: 1 }} />
              <Button title="Edit" variant="outline" onPress={() => setEditing(p)} style={{ flex: 1 }} />
            </View>
          </Tile>
        );
      })}
      {data.providers.length === 0 ? (
        <Pressable onPress={() => setEditing('new')}>
          <Text style={s.small}>No providers yet. Add one to switch AI features on.</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  usage: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  usageLabel: { width: 78, fontFamily: fonts.mono, fontSize: 10, color: colors.mute },
  usageValue: { flex: 1, textAlign: 'right', fontFamily: fonts.mono, fontSize: 10, color: colors.ink },
  limitLine: { fontFamily: fonts.mono, fontSize: 10, color: colors.mute, lineHeight: 15 },
});