import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import Button from '../components/Button';
import DotMeter from '../components/dot/DotMeter';
import DotText from '../components/dot/DotText';
import Field from '../components/Field';
import Screen from '../components/Screen';
import Tile from '../components/Tile';
import { useAuth } from '../lib/auth';
import { formatShortDate } from '../lib/dates';
import { describeResearchError, normalizeOrg, requestResearch } from '../lib/org';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius } from '../lib/theme';
import { useTabActive, useTabs } from '../navigation/tabs';

function remainingCredits(ent) {
  if (!ent || ent.research_limit == null) return null; // unlimited or unknown
  return Math.max(0, ent.research_limit - ent.research_used);
}

function QuotaTile({ ent, onUpgrade }) {
  if (!ent) return null;
  const unlimited = ent.research_limit == null;
  const left = remainingCredits(ent);
  const resets = ent.research_resets_at ? formatShortDate(ent.research_resets_at) : '';
  return (
    <Tile
      label="Research credits"
      style={{ marginBottom: 20 }}
      right={
        <View style={styles.pill}>
          <Text style={styles.pillText}>{ent.plan_name}</Text>
        </View>
      }
      onPress={ent.plan_id === 'free' ? onUpgrade : undefined}
    >
      {unlimited ? (
        <Text style={styles.strong}>Unlimited on your plan</Text>
      ) : (
        <>
          <Text style={styles.strong}>
            {left} of {ent.research_limit} left this month
          </Text>
          <View style={{ marginTop: 12 }}>
            <DotMeter
              value={(left / ent.research_limit) * 100}
              count={Math.min(ent.research_limit, 20)}
              dot={7}
              gap={5}
            />
          </View>
          <Text style={[styles.small, { marginTop: 12 }]}>
            Resets {resets}. Opening saved research and running mock interviews
            never uses a credit.
          </Text>
          {ent.plan_id === 'free' ? (
            <Text style={[styles.small, { marginTop: 8, color: colors.accent }]}>
              Tap for more research on Pro
            </Text>
          ) : null}
        </>
      )}
    </Tile>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullets({ items }) {
  return items.map((t, i) => (
    <Text key={i} style={[styles.body, i > 0 && { marginTop: 6 }]}>
      - {t}
    </Text>
  ));
}

function ResearchDetail({ item, ent, onBack, onChanged, onUpgrade }) {
  const { profile, refreshEntitlements } = useAuth();
  const { goTo } = useTabs();
  const [notes, setNotes] = useState(item.notes ?? '');
  const [savedNotes, setSavedNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const c = item.content ?? {};
  const sources = Array.isArray(item.sources) ? item.sources : [];

  const saveNotes = async () => {
    setError(null);
    const { error: err } = await supabase
      .from('org_research')
      .update({ notes: notes.trim() })
      .eq('id', item.id);
    if (err) setError("Couldn't save your notes. Try again.");
    else {
      setSavedNotes(true);
      onChanged();
    }
  };

  const doRefresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await requestResearch({
        orgName: item.org_name,
        roleFocus: item.role_focus,
        refresh: true,
      });
      if (res.research) onChanged(res.research);
      else await onChanged();
      await refreshEntitlements();
    } catch (e) {
      if (e.code === 'RESEARCH_LIMIT') onUpgrade(e.detail);
      else setError(describeResearchError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmRefresh = () => {
    const left = remainingCredits(ent);
    const cost = left === null ? 'This refreshes the research.' : `This uses 1 of your ${left} remaining credits this month.`;
    Alert.alert('Refresh this research?', `${cost} Your current version stays in use until the new one is ready.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Refresh', onPress: doRefresh },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this research?', 'Getting it back would use a research credit.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase.from('org_research').delete().eq('id', item.id);
          if (err) setError("Couldn't delete it. Try again.");
          else {
            await onChanged();
            onBack();
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Pressable onPress={onBack} accessibilityRole="button" style={{ marginBottom: 18 }}>
        <Text style={styles.back}>Back to research</Text>
      </Pressable>

      <Text style={styles.title}>{item.org_name}</Text>
      <Text style={[styles.small, { marginTop: 6, marginBottom: 18 }]}>
        {item.role_focus ? `For ${item.role_focus}. ` : ''}
        Researched {formatShortDate(item.researched_at)}
      </Text>

      {!item.grounded ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Written from the AI's general knowledge, not live web research. It
            can be out of date or wrong, so check the organisation's own site
            before relying on details.
          </Text>
        </View>
      ) : null}

      {c.overview ? (
        <Section title="Overview">
          <Text style={styles.body}>{c.overview}</Text>
        </Section>
      ) : null}
      {c.vision ? (
        <Section title="Vision">
          <Text style={styles.body}>{c.vision}</Text>
        </Section>
      ) : null}
      {c.values?.length ? (
        <Section title="Values">
          <Bullets items={c.values} />
        </Section>
      ) : null}
      {c.culture?.length ? (
        <Section title="Culture">
          <Bullets items={c.culture} />
        </Section>
      ) : null}
      {c.area ? (
        <Section title="The area they operate in">
          <Text style={styles.body}>{c.area}</Text>
        </Section>
      ) : null}
      {c.challenges?.length ? (
        <Section title="Current challenges">
          <Bullets items={c.challenges} />
        </Section>
      ) : null}
      {c.strengths?.length ? (
        <Section title="Wins and strengths">
          <Bullets items={c.strengths} />
        </Section>
      ) : null}
      {c.interview_process ? (
        <Section title="How they hire">
          <Text style={styles.body}>{c.interview_process}</Text>
        </Section>
      ) : null}
      {c.likely_topics?.length ? (
        <Section title="Be ready to discuss">
          <Bullets items={c.likely_topics} />
        </Section>
      ) : null}
      {c.questions_to_ask?.length ? (
        <Section title="Questions to ask them">
          <Bullets items={c.questions_to_ask} />
        </Section>
      ) : null}
      {c.recent?.length ? (
        <Section title="Recent">
          <Bullets items={c.recent} />
        </Section>
      ) : null}
      {c.caveats ? (
        <Section title="Double-check">
          <Text style={styles.body}>{c.caveats}</Text>
        </Section>
      ) : null}
      {sources.length ? (
        <Section title="Sources">
          {sources.map((s) => (
            <Pressable key={s.url} onPress={() => /^https?:\/\//.test(s.url) && Linking.openURL(s.url)}>
              <Text style={styles.link} numberOfLines={1}>
                {s.title || s.url}
              </Text>
            </Pressable>
          ))}
        </Section>
      ) : null}

      <View style={{ marginTop: 6 }}>
        <Field
          label="Your notes"
          value={notes}
          onChangeText={(t) => {
            setNotes(t);
            setSavedNotes(false);
          }}
          placeholder="Add what you know: people you've spoken to, things you've read, corrections to the research above."
          multiline
          hint="Free to edit. Mock interviews for this organisation use your notes too."
          style={{ marginBottom: 12 }}
        />
        <Button
          title={savedNotes ? 'Notes saved' : 'Save notes'}
          variant="outline"
          onPress={saveNotes}
          disabled={notes === (item.notes ?? '') && !savedNotes}
          style={{ marginBottom: 22 }}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={`Practise for ${item.org_name}`}
        onPress={() =>
          goTo('mock', { company: item.org_name, role: item.role_focus || profile?.target_role || '' })
        }
        style={{ marginBottom: 10 }}
      />
      <Button
        title="Refresh research"
        variant="outline"
        onPress={confirmRefresh}
        loading={busy}
        style={{ marginBottom: 10 }}
      />
      <Button title="Delete" variant="ghost" onPress={confirmDelete} />
    </Screen>
  );
}

export default function ResearchScreen() {
  const navigation = useNavigation();
  const { params } = useTabs();
  const { profile, entitlements, refreshEntitlements } = useAuth();
  const isActive = useTabActive('research');
  const isFocused = useIsFocused();

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState(profile?.target_role ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async (incoming) => {
    if (incoming?.id) {
      setItems((prev) => {
        const rest = prev.filter((i) => i.id !== incoming.id && i.org_key !== incoming.org_key);
        return [incoming, ...rest];
      });
    }
    const { data, error: err } = await supabase
      .from('org_research')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) {
      if (!incoming?.id) setError("Couldn't load your saved research.");
    } else if (data?.length) {
      setItems(data);
    } else if (!incoming?.id) {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (isActive && isFocused) {
      load();
      refreshEntitlements();
    }
  }, [isActive, isFocused, load, refreshEntitlements]);

  useEffect(() => {
    if (params?.prefillOrg) {
      setOrgName(params.prefillOrg);
      if (params.prefillRole) setRole(params.prefillRole);
      setSelectedId(null);
    }
  }, [params?.prefillOrg, params?.prefillRole]);

  const promptUpgrade = (detail) => {
    const limit = detail?.limit ?? entitlements?.research_limit;
    const resets = detail?.resets_at ?? entitlements?.research_resets_at;
    Alert.alert(
      'Monthly research limit reached',
      `Your plan includes ${limit} organisation researches a month${resets ? `, resetting on ${formatShortDate(resets)}` : ''}. Your saved research and mock interviews keep working.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'See plans', onPress: () => navigation.navigate('Upgrade') },
      ]
    );
  };

  const search = async () => {
    setError(null);
    setNotice(null);
    const name = orgName.trim();
    if (name.length < 2) {
      setError('Enter the name of an organisation.');
      return;
    }
    const key = normalizeOrg(name);
    const existing = items.find((i) => i.org_key === key);
    if (existing) {
      setNotice(`You already researched ${existing.org_name}. Here's your saved version. Use Refresh if you want it updated.`);
      setSelectedId(existing.id);
      return;
    }
    if (remainingCredits(entitlements) === 0) {
      promptUpgrade();
      return;
    }
    setBusy(true);
    try {
      const res = await requestResearch({ orgName: name, roleFocus: role.trim() });
      const research = res.research;
      setItems((prev) => {
        const rest = prev.filter((i) => i.id !== research.id && i.org_key !== research.org_key);
        return [research, ...rest];
      });
      await refreshEntitlements();
      setOrgName('');
      setSelectedId(research.id);
    } catch (e) {
      if (e.code === 'RESEARCH_LIMIT') promptUpgrade(e.detail);
      else setError(describeResearchError(e));
    } finally {
      setBusy(false);
    }
  };

  const selected = items.find((i) => i.id === selectedId);
  if (selected) {
    return (
      <ResearchDetail
        item={selected}
        ent={entitlements}
        onBack={() => setSelectedId(null)}
        onChanged={load}
        onUpgrade={promptUpgrade}
      />
    );
  }

  const key = normalizeOrg(orgName);
  const matches = key
    ? items.filter((i) => i.org_key.includes(key) || key.includes(i.org_key)).slice(0, 3)
    : [];

  return (
    <Screen>
      <DotText text="RESEARCH" dot={4} gap={2} />
      <Text style={styles.intro}>
        Look up an organisation once. It's saved, reused in every mock
        interview, and only refreshed when you choose.
      </Text>

      <QuotaTile ent={entitlements} onUpgrade={() => navigation.navigate('Upgrade')} />

      <Field
        label="Organisation"
        value={orgName}
        onChangeText={(t) => {
          setOrgName(t);
          setNotice(null);
        }}
        placeholder="Your dream company"
        autoCapitalize="words"
      />
      {matches.length ? (
        <View style={{ marginTop: -6, marginBottom: 14 }}>
          <Text style={styles.small}>Already saved:</Text>
          {matches.map((m) => (
            <Pressable key={m.id} onPress={() => setSelectedId(m.id)}>
              <Text style={styles.link}>{m.org_name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field
        label="Role focus"
        value={role}
        onChangeText={setRole}
        placeholder="Optional"
        autoCapitalize="words"
      />

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Research organisation" onPress={search} loading={busy} />
      {busy ? (
        <Text style={[styles.small, { marginTop: 12, textAlign: 'center' }]}>
          This can take up to a minute.
        </Text>
      ) : null}

      <Text style={styles.listTitle}>Saved research</Text>
      {items.length === 0 ? (
        <Text style={styles.small}>Nothing saved yet. Your first lookup will appear here.</Text>
      ) : (
        items.map((i, n) => (
          <Tile
            key={i.id}
            index={String(n + 1).padStart(2, '0')}
            label={formatShortDate(i.researched_at)}
            style={{ marginBottom: 10 }}
            right={
              <View style={[styles.pill, i.grounded && { borderColor: colors.ink }]}>
                <Text style={styles.pillText}>{i.grounded ? 'Sourced' : 'General'}</Text>
              </View>
            }
            onPress={() => setSelectedId(i.id)}
            accessibilityLabel={`Open research on ${i.org_name}`}
          >
            <Text style={styles.strong} numberOfLines={1}>
              {i.org_name}
            </Text>
            {i.role_focus ? (
              <Text style={[styles.small, { marginTop: 4 }]} numberOfLines={1}>
                {i.role_focus}
              </Text>
            ) : null}
          </Tile>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mute,
    marginTop: 22,
    marginBottom: 22,
  },
  title: { fontFamily: fonts.monoBold, fontSize: 22, lineHeight: 30, color: colors.ink },
  strong: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
  small: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 17, color: colors.mute },
  body: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 21, color: colors.ink },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.mute,
    marginBottom: 8,
  },
  listTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 34,
    marginBottom: 14,
  },
  back: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },
  link: { fontFamily: fonts.mono, fontSize: 12, color: colors.accent, paddingVertical: 5 },
  banner: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.field,
    padding: 12,
    marginBottom: 18,
  },
  bannerText: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 17, color: colors.mute },
  pill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.ink },
  notice: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.ink, marginBottom: 14 },
  error: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.accent, marginBottom: 14 },
});
