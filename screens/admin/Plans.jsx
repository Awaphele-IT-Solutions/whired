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
      await adminCall('plan_save', { plan: { id: plan.id, ...f } });
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
      {plan.id !== 'free' ? (
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

export default function Plans({ data, reload }) {
  const { colors, fonts, radius } = useTheme();
  const s = getAdminStyles(colors, fonts, radius);
  return (
    <View>
      <Text style={[s.small, { marginBottom: 16 }]}>
        Plan limits are read live, so you can tune them as your AI capacity
        grows. Check the Overview tab to see how much headroom you have first.
      </Text>
      {data.plans.map((p, i) => (
        <PlanCard key={p.id} plan={p} index={String(i + 1).padStart(2, '0')} onSaved={reload} />
      ))}
    </View>
  );
}
