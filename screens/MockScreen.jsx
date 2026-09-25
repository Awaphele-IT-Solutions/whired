import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import Blink from '../components/Blink';
import Button from '../components/Button';
import Chip from '../components/Chip';
import DotMeter from '../components/dot/DotMeter';
import DotRing from '../components/dot/DotRing';
import DotText from '../components/dot/DotText';
import Field from '../components/Field';
import Screen from '../components/Screen';
import { LEVELS } from '../components/TargetForm';
import Tile from '../components/Tile';
import { useAuth } from '../lib/auth';
import { describeInterviewError, fetchSummary, fetchTurn } from '../lib/interview';
import { normalizeOrg } from '../lib/org';
import { SKILLS } from '../lib/stats';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';
import { useTabs } from '../navigation/tabs';

const CATEGORIES = [
  { key: 'behavioural', label: 'Behavioural' },
  { key: 'technical', label: 'Technical' },
  { key: 'situational', label: 'Situational' },
  { key: 'mixed', label: 'Mixed' },
];
const LENGTHS = [3, 5, 8];

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

function normaliseSummary(raw) {
  const stats = {};
  for (const s of SKILLS) stats[s.key] = clampScore(raw?.stats?.[s.key]);
  const verdictRaw = String(raw?.fit_verdict ?? '').toLowerCase().trim();
  const verdict = ['strong match', 'possible match', 'weak match', 'unclear'].includes(verdictRaw)
    ? verdictRaw
    : '';
  return {
    score: clampScore(raw?.score),
    message: typeof raw?.message === 'string' ? raw.message : '',
    feedback: Array.isArray(raw?.feedback)
      ? raw.feedback.filter((f) => typeof f === 'string' && f.trim())
      : [],
    stats,
    fit_score: clampScore(raw?.fit_score ?? raw?.stats?.culture_fit),
    fit_verdict: verdict,
    fit_why: Array.isArray(raw?.fit_why) ? raw.fit_why.filter((f) => typeof f === 'string' && f.trim()) : [],
    fit_gaps: Array.isArray(raw?.fit_gaps) ? raw.fit_gaps.filter((f) => typeof f === 'string' && f.trim()) : [],
  };
}

export default function MockScreen() {
  const { profile } = useAuth();
  const { params, goTo } = useTabs();
  const preset = params?.presetQuestion || null;
  const paramCompany = params?.company || null;
  const paramRole = params?.role || null;

  // Setup
  const [phase, setPhase] = useState('setup'); // setup | run | done
  const [company, setCompany] = useState(profile?.target_company ?? '');
  const [role, setRole] = useState(profile?.target_role ?? '');
  const [category, setCategory] = useState('behavioural');
  const [level, setLevel] = useState(profile?.experience_level ?? 'mid');
  const [total, setTotal] = useState(5);

  // Session
  const [history, setHistory] = useState([]);
  const [turn, setTurn] = useState(1);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [nextQ, setNextQ] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | failed

  // Saved research for the company typed in setup (reused, never re-charged)
  const [savedResearch, setSavedResearch] = useState(null);

  // Flow
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep setup in step with profile edits made on the You tab.
  useEffect(() => {
    if (phase !== 'setup') return;
    setCompany(profile?.target_company ?? '');
    setRole(profile?.target_role ?? '');
    setLevel(profile?.experience_level ?? 'mid');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.target_company, profile?.target_role, profile?.experience_level]);

  // Arriving from the Research tab pre-fills the company and role.
  useEffect(() => {
    if (!paramCompany || phase !== 'setup') return;
    setCompany(paramCompany);
    if (paramRole) setRole(paramRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramCompany, paramRole]);

  // Look for saved research on this company so the user knows it will be used.
  useEffect(() => {
    const key = normalizeOrg(company);
    if (phase !== 'setup' || !key) {
      setSavedResearch(null);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('org_research')
        .select('id, org_name, grounded')
        .eq('org_key', key)
        .maybeSingle();
      if (alive) setSavedResearch(data ?? null);
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [company, phase]);

  const context = {
    company: company.trim(),
    role: role.trim(),
    category,
    level,
    totalTurns: total,
  };

  const resetToSetup = () => {
    setPhase('setup');
    setHistory([]);
    setTurn(1);
    setQuestion('');
    setAnswer('');
    setFeedback(null);
    setNextQ(null);
    setSubmitted(false);
    setSummary(null);
    setSaveState('idle');
    setError(null);
  };

  const start = async () => {
    if (!role.trim()) {
      setError('Add the role you are preparing for.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let first = preset;
      if (!first) {
        const res = await fetchTurn({ context, history: [], turnNumber: 1 });
        first = res?.nextQuestion;
      }
      if (!first) throw new Error('REQUEST_FAILED');
      setHistory([]);
      setTurn(1);
      setQuestion(first);
      setAnswer('');
      setFeedback(null);
      setNextQ(null);
      setSubmitted(false);
      setSummary(null);
      setSaveState('idle');
      setPhase('run');
    } catch (e) {
      setError(describeInterviewError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    const text = answer.trim();
    if (!text || loading) return;
    const updated = [
      ...history,
      { role: 'assistant', content: question },
      { role: 'user', content: text },
    ];
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTurn({ context, history: updated, turnNumber: turn });
      setHistory(updated);
      setFeedback(res?.feedback || '');
      setNextQ(res?.nextQuestion || null);
      setSubmitted(true);
    } catch (e) {
      setError(describeInterviewError(e));
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (result, transcript) => {
    setSaveState('saving');
    const { error: err } = await supabase.from('interview_sessions').insert({
      company: context.company || null,
      role: context.role,
      category,
      level,
      question_count: total,
      score: result.score,
      stats: {
        ...result.stats,
        fit_score: result.fit_score,
        fit_verdict: result.fit_verdict,
      },
      feedback: [
        ...(result.feedback || []),
        ...(result.fit_why || []).map((f) => `Fit: ${f}`),
        ...(result.fit_gaps || []).map((f) => `Gap: ${f}`),
      ],
      transcript,
    });
    setSaveState(err ? 'failed' : 'saved');
  };

  const finish = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSummary({ context, history });
      const result = normaliseSummary(res);
      setSummary(result);
      setPhase('done');
      setLoading(false);
      await saveSession(result, history);
    } catch (e) {
      setError(describeInterviewError(e));
      setLoading(false);
    }
  };

  const next = () => {
    if (nextQ) {
      setQuestion(nextQ);
      setTurn((t) => t + 1);
      setAnswer('');
      setFeedback(null);
      setNextQ(null);
      setSubmitted(false);
      setError(null);
      return;
    }
    finish();
  };

  const confirmEnd = () => {
    Alert.alert('End this session?', 'Your answers so far will not be saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: resetToSetup },
    ]);
  };

  // ---------------------------------------------------------------- setup
  if (phase === 'setup') {
    return (
      <Screen>
        <DotText text="MOCK" dot={5} gap={2} />
        <Text style={styles.title}>Mock interview</Text>
        <Text style={styles.body}>
          An AI interviewer asks one question at a time and gives feedback on
          each answer. Write your answers as you would say them out loud.
        </Text>

        {preset ? (
          <Tile label="Starting question" style={{ marginBottom: 18 }}>
            <Text style={styles.presetText}>{preset}</Text>
          </Tile>
        ) : null}

        <Field
          label="Role"
          value={role}
          onChangeText={setRole}
          placeholder="e.g. Product designer"
          autoCapitalize="words"
        />
        <Field
          label="Company"
          value={company}
          onChangeText={setCompany}
          placeholder="Optional"
          autoCapitalize="words"
        />

        {company.trim() ? (
          savedResearch ? (
            <Text style={styles.researchNote}>
              Using your saved research on {savedResearch.org_name}. Your notes
              on it are included too.
            </Text>
          ) : (
            <Text style={styles.researchNote}>
              No saved research on {company.trim()} yet.{' '}
              <Text
                style={styles.researchLink}
                onPress={() => goTo('research', { prefillOrg: company.trim(), prefillRole: role.trim() })}
              >
                Research it first
              </Text>{' '}
              for sharper questions.
            </Text>
          )
        ) : null}

        <Text style={styles.label}>Type of interview</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
          ))}
        </View>

        <Text style={styles.label}>Your level</Text>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l.key} label={l.label} selected={level === l.key} onPress={() => setLevel(l.key)} />
          ))}
        </View>

        <Text style={styles.label}>Length</Text>
        <View style={styles.chips}>
          {LENGTHS.map((n) => (
            <Chip key={n} label={n + ' questions'} selected={total === n} onPress={() => setTotal(n)} />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Start interview" onPress={start} loading={loading} />

        <Text style={styles.disclosure}>
          Questions and feedback are generated by AI and can be wrong. Your
          answers are sent to an AI provider to produce that feedback.
        </Text>
      </Screen>
    );
  }

  // ----------------------------------------------------------------- done
  if (phase === 'done' && summary) {
    return (
      <Screen>
        <DotText text="RESULTS" dot={5} gap={2} />
        <View style={{ alignItems: 'center', marginVertical: 28 }}>
          <DotRing size={170} count={64} progress={summary.score / 100} dot={4}>
            <DotText
              text={String(summary.score)}
              dot={summary.score >= 100 ? 4 : 5}
              gap={2}
            />
            <Text style={[styles.micro, { marginTop: 8 }]}>out of 100</Text>
          </DotRing>
          {summary.message ? <Text style={styles.message}>{summary.message}</Text> : null}
        </View>

        <Tile label="Skills" style={{ marginBottom: 12 }}>
          {SKILLS.map((s) => (
            <View key={s.key} style={styles.statRow}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <DotMeter value={summary.stats[s.key]} count={10} dot={6} gap={4} />
              <Text style={styles.statValue}>{summary.stats[s.key]}</Text>
            </View>
          ))}
        </Tile>

        {summary.fit_verdict || summary.fit_why.length || summary.fit_gaps.length ? (
          <Tile
            label="Role fit"
            right={
              summary.fit_verdict ? (
                <Text style={styles.statValue}>{summary.fit_score}</Text>
              ) : null
            }
            style={{ marginBottom: 12 }}
          >
            {summary.fit_verdict ? (
              <Text style={[styles.note, { marginBottom: 10 }]}>
                {summary.fit_verdict.charAt(0).toUpperCase() + summary.fit_verdict.slice(1)}
                {summary.fit_score ? ` · ${summary.fit_score} / 100` : ''}
              </Text>
            ) : null}
            {summary.fit_why.map((f, i) => (
              <Text key={`why-${i}`} style={[styles.note, i > 0 && { marginTop: 10 }]}>
                Match: {f}
              </Text>
            ))}
            {summary.fit_gaps.map((f, i) => (
              <Text key={`gap-${i}`} style={[styles.note, { marginTop: summary.fit_why.length || i ? 10 : 0 }]}>
                Gap: {f}
              </Text>
            ))}
          </Tile>
        ) : null}

        {summary.feedback.length ? (
          <Tile label="Coach notes" style={{ marginBottom: 18 }}>
            {summary.feedback.map((f, i) => (
              <Text key={i} style={[styles.note, i > 0 && { marginTop: 12 }]}>
                {f}
              </Text>
            ))}
          </Tile>
        ) : null}

        <Text style={styles.saveState}>
          {saveState === 'saving' && 'Saving to your history...'}
          {saveState === 'saved' && 'Saved to your history.'}
          {saveState === 'failed' && "Couldn't save this session."}
        </Text>
        {saveState === 'failed' ? (
          <Button
            title="Try saving again"
            variant="outline"
            onPress={() => saveSession(summary, history)}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <Button title="Run another mock" onPress={resetToSetup} style={{ marginBottom: 10 }} />
        <Button title="Back to home" variant="outline" onPress={() => goTo('home')} />
      </Screen>
    );
  }

  // ------------------------------------------------------------------ run
  const answered = submitted ? turn : turn - 1;
  const isLast = turn >= total;
  const status = loading ? 'THINKING' : submitted ? 'FEEDBACK' : 'YOUR TURN';

  return (
    <Screen>
      <View style={styles.statusRow}>
        <DotText text={status} dot={3} gap={1.5} />
        {loading ? <Blink size={16} /> : null}
        <View style={{ flex: 1 }} />
        <Text style={styles.micro}>
          {turn} of {total}
        </Text>
      </View>
      <View style={{ marginTop: 16, marginBottom: 22 }}>
        <DotMeter value={(answered / total) * 100} count={total} dot={8} gap={6} />
      </View>

      <Tile label="Question" style={{ marginBottom: 18 }}>
        <Text style={styles.question}>{question}</Text>
      </Tile>

      {!submitted ? (
        <>
          <Field
            label="Your answer"
            value={answer}
            onChangeText={setAnswer}
            placeholder="Answer as you would in the room. About a minute of speaking is a good length."
            multiline
            style={{ marginBottom: 14 }}
            inputStyle={{ minHeight: 160 }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Submit answer"
            onPress={submitAnswer}
            loading={loading}
            disabled={!answer.trim()}
          />
        </>
      ) : (
        <>
          <Tile label="Feedback" style={{ marginBottom: 18 }}>
            <Text style={styles.note}>{feedback}</Text>
          </Tile>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={isLast ? 'See results' : 'Next question'}
            onPress={next}
            loading={loading}
          />
        </>
      )}

      <Button
        title="End session"
        variant="ghost"
        onPress={confirmEnd}
        style={{ marginTop: 10 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.ink,
    marginTop: 26,
    marginBottom: 10,
  },
  body: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mute,
    marginBottom: 26,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.mute,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  researchNote: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mute,
    marginTop: -6,
    marginBottom: 20,
  },
  researchLink: { fontFamily: fonts.monoBold, color: colors.accent },
  presetText: { fontFamily: fonts.monoBold, fontSize: 14, lineHeight: 22, color: colors.ink },
  error: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.accent,
    marginBottom: 14,
  },
  disclosure: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 17,
    color: colors.faint,
    marginTop: 18,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  micro: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.mute,
  },
  question: { fontFamily: fonts.monoBold, fontSize: 16, lineHeight: 25, color: colors.ink },
  note: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 21, color: colors.ink },
  message: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 22,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  statLabel: { width: 104, fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
  statValue: {
    width: 30,
    textAlign: 'right',
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.ink,
  },
  saveState: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.mute,
    marginBottom: 12,
    textAlign: 'center',
  },
});
