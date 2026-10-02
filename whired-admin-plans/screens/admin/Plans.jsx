import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import Button from '../../components/Button';
import Field from '../../components/Field';
import Tile from '../../components/Tile';
import { adminCall } from '../../lib/admin';
import { useTheme } from '../../lib/ThemeContext';
import { getAdminStyles } from './common';

const blank = (v) => (v === null || v === undefined ? '' : String(v));

function PlanCard({ plan, index, onSaved }) {
  const { colors, fonts, radius } = useTheme();
  const s = getAdminStyles(colors, fonts, radius);
  const [f, setF] = useState({
    name: plan.name,
    description: plan.description,
    price_label: plan.price_label,
    research_per_month: blank(plan.research_per_month),
    daily_ai_calls: blank(plan.daily_ai_calls),
    features: (plan.features ?? []).join('\n'),
    rc_entitlement: plan.rc_entitlement ?? '',
    active: plan.active,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (patch) => {
    setMessage(null);
    setF((p) => ({ ...p, ...patch }));
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await adminCall('plan_save', {
        plan: {
          id: plan.id,
          ...f,
          features: f.features.split('\n').map((l) => l.trim()).filter(Boolean),
        },
      });
      setMessage('Saved. Changes apply to users straight away.');
      onSaved();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tile index={index} label={`${plan.id} plan`} style={{ marginBottom: 12 }}>
      <Field label="Name" value={f.name} onChangeText={(v) => set({ name: v })} />
      <Field label="Description" value={f.description} onChangeText={(v) => set({ description: v })} multiline inputStyle={{ minHeight: 70 }} />
      <Field
        label="Price label"
        value={f.price_label}
        onChangeText={(v) => set({ price_label: v })}
        hint="Display only. The real price is set in App Store Connect and Play Console."
      />
      <Field
        label="Organisation researches per month"
        value={f.research_per_month}
        onChangeText={(v) => set({ research_per_month: v })}
        placeholder="Blank = unlimited"
        keyboardType="number-pad"
      />
      <Field
        label="AI calls per user per day"
        value={f.daily_ai_calls}
        onChangeText={(v) => set({ daily_ai_calls: v })}
        placeholder="Blank = unlimited"
        keyboardType="number-pad"
        hint="Fair-use ceiling for mock interviews. One 5-question interview is about 7 calls."
      />
      <Field
        label="What this tier includes"
        value={f.features}
        onChangeText={(v) => set({ features: v })}
        multiline
        inputStyle={{ minHeight: 110 }}
        hint="One line per bullet, up to 8. Shown on the Upgrade screen. Leave blank to use the automatic list built from the limits."
      />
      {plan.id !== 'free' && plan.id !== 'dev' ? (
        <Field
          label="RevenueCat entitlement"
          value={f.rc_entitlement}
          onChangeText={(v) => set({ rc_entitlement: v.trim() })}
          placeholder="e.g. pro"
          autoCapitalize="none"
          hint="Buying anything attached to this entitlement in RevenueCat puts the user on this plan."
        />
      ) : null}
      {plan.id !== 'free' && plan.id !== 'dev' ? (
        <View style={s.row}>
          <Text style={s.body}>Offered to users</Text>
          <Switch
            value={f.active}
            onValueChange={(v) => set({ active: v })}
            trackColor={{ false: colors.dotOff, true: colors.accent }}
            thumbColor={colors.ink}
          />
        </View>
      ) : null}
      {message ? <Text style={[s.small, { marginBottom: 12, color: colors.ink }]}>{message}</Text> : null}
      <Button title="Save plan" onPress={save} loading={busy} />
    </Tile>
  );
}

function NewPlan({ onCreated }) {
  const { colors, fonts, radius } = useTheme();
  const s = getAdminStyles(colors, fonts, radius);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await adminCall('plan_create', { id, name });
      setId('');
      setName('');
      setMessage('Created, switched off. Set its limits below, then turn "Offered to users" on.');
      onCreated();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tile index="+" label="new tier" style={{ marginBottom: 12 }}>
      <Field label="Plan id" value={id} onChangeText={(v) => setId(v.toLowerCase())} placeholder="e.g. plus" autoCapitalize="none" hint="Lowercase, permanent." />
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Plus" />
      {message ? <Text style={[s.small, { marginBottom: 12, color: colors.ink }]}>{message}</Text> : null}
      <Button title="Create tier" onPress={create} loading={busy} disabled={!id.trim()} />
    </Tile>
  );
}

export default function Plans({ data, reload }) {
  const { colors, fonts, radius } = useTheme();
  const s = getAdminStyles(colors, fonts, radius);
  return (
    <View>
      <Text style={[s.small, { marginBottom: 16 }]}>
        Plan limits are read live, so you can tune them as your AI capacity
        grows. Check the Overview tab to see how much headroom you have first.
        The Dev plan is unlimited and applies to admins automatically.
      </Text>
      {data.plans.map((p, i) => (
        <PlanCard key={`${p.id}-${p.updated_at}`} plan={p} index={String(i + 1).padStart(2, '0')} onSaved={reload} />
      ))}
      <NewPlan onCreated={reload} />
    </View>
  );
}
