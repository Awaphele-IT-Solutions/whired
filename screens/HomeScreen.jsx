import React, { useEffect, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import Blink from '../components/Blink';
import DotBars from '../components/dot/DotBars';
import DotLine from '../components/dot/DotLine';
import DotMeter from '../components/dot/DotMeter';
import DotRing from '../components/dot/DotRing';
import DotText from '../components/dot/DotText';
import Screen from '../components/Screen';
import Steps from '../components/Steps';
import Tile from '../components/Tile';
import { useAuth } from '../lib/auth';
import { DAILY_QUESTIONS } from '../lib/questions';
import {
  SKILLS,
  computeStreak,
  dayOfYear,
  daysUntil,
  latestStats,
  prepProgress,
  scoreSeries,
  weakestSkill,
} from '../lib/stats';
import { colors, fonts, radius } from '../lib/theme';
import { useDashboard } from '../lib/useDashboard';
import { useTabActive, useTabs } from '../navigation/tabs';

const GAP = 12;
const PAD = 20;
const STORY_GOAL = 6;

function DeltaPill({ value }) {
  if (value === null || value === undefined) return null;
  const label = (value > 0 ? '+' : '') + value;
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const { profile, entitlements } = useAuth();
  const { goTo } = useTabs();
  const isActive = useTabActive('home');
  const isFocused = useIsFocused();
  const { sessions, storyCount, error, reload } = useDashboard();

  useEffect(() => {
    if (isActive && isFocused) reload();
  }, [isActive, isFocused, reload]);

  const tileW = Math.floor((width - PAD * 2 - GAP) / 2);
  const tileH = Math.round(tileW * 1.22);
  const innerW = tileW - 34;
  const bodyH = tileH - 34 - 26;
  const wideInnerW = width - PAD * 2 - 34;

  const d = useMemo(() => {
    const scores = scoreSeries(sessions, 10);
    const stats = latestStats(sessions);
    const latest = sessions.find((s) => typeof s.score === 'number');
    const scored = sessions.filter((s) => typeof s.score === 'number');
    return {
      scores,
      stats,
      weakest: weakestSkill(stats),
      latest: latest ? latest.score : null,
      delta: scored.length >= 2 ? scored[0].score - scored[1].score : null,
      trendDelta: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null,
      streak: computeStreak(sessions),
    };
  }, [sessions]);

  const days = daysUntil(profile?.interview_date);
  const prep = prepProgress(profile);
  const question = DAILY_QUESTIONS[dayOfYear() % DAILY_QUESTIONS.length];
  const tileSize = { width: tileW, height: tileH };

  let status = 'Set your interview date';
  if (days !== null) {
    const who = profile?.target_company || 'your interview';
    if (days < 0) status = 'Interview date passed. Set a new one.';
    else if (days === 0) status = 'Interview day. Walk in ready.';
    else status = days + (days === 1 ? ' day' : ' days') + ' until ' + who;
  }

  const ringSize = Math.max(64, Math.min(innerW, bodyH - 44, 100));
  const dayDigits = days !== null && days >= 0 ? String(Math.min(days, 999)) : '';

  return (
    <Screen>
      {/* Header */}
      <DotText text="W/HIRED" dot={4} gap={2} accentChars="/" />
      <View style={{ height: 10 }} />
      <DotText text="PREP DASHBOARD" dot={2} gap={1.2} color={colors.mute} />
      <View style={styles.status}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText} numberOfLines={1}>
          {status}
        </Text>
      </View>

      {error ? (
        <Pressable onPress={reload} style={styles.errorBar}>
          <Text style={styles.errorText}>
            Couldn't load your stats. Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        {/* 01 Target */}
        <Tile index="01" label="Target" style={tileSize} onPress={() => goTo('you')}>
          <View style={{ alignItems: 'center' }}>
            <DotRing size={ringSize} count={48} progress={prep} dot={3}>
              {dayDigits ? (
                <View style={{ alignItems: 'center' }}>
                  <DotText
                    text={dayDigits}
                    dot={dayDigits.length >= 3 ? 2.5 : 3.5}
                    gap={dayDigits.length >= 3 ? 1.2 : 1.5}
                  />
                  <Text style={styles.micro}>{dayDigits === '1' ? 'day' : 'days'}</Text>
                </View>
              ) : (
                <Text style={styles.micro}>{days !== null ? 'passed' : 'set date'}</Text>
              )}
            </DotRing>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.strong} numberOfLines={1}>
            {profile?.target_company || profile?.target_role || 'Your target'}
          </Text>
          {profile?.target_company && profile?.target_role ? (
            <Text style={styles.small} numberOfLines={1}>
              {profile.target_role}
            </Text>
          ) : null}
        </Tile>

        {/* 02 Last score */}
        <Tile
          index="02"
          label="Last score"
          style={tileSize}
          right={<DeltaPill value={d.delta} />}
          onPress={() => goTo('mock')}
        >
          <DotText
            text={d.latest === null ? '--' : String(d.latest)}
            dot={d.latest !== null && d.latest >= 100 ? 3 : 4}
            gap={2}
          />
          <Text style={[styles.small, { marginTop: 8 }]}>
            {sessions.length === 0
              ? 'No sessions yet'
              : sessions.length + (sessions.length === 1 ? ' session' : ' sessions')}
          </Text>
          <View style={{ flex: 1 }} />
          <DotBars
            values={d.scores.map((s) => s / 100)}
            rows={5}
            dot={4}
            gap={3}
            accentLast={d.scores.length ? 1 : 0}
          />
        </Tile>

        {/* 03 Streak */}
        <Tile index="03" label="Streak" style={tileSize} onPress={() => goTo('mock')}>
          <DotText text={String(d.streak.streak)} dot={4} gap={2} />
          <Text style={[styles.small, { marginTop: 8 }]}>
            {d.streak.streak === 1 ? 'day in a row' : 'days in a row'}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={styles.streakGrid}>
            {d.streak.last14.map((on, i) => {
              const isToday = i === 13;
              return (
                <View
                  key={i}
                  style={[
                    styles.streakDot,
                    on && { backgroundColor: isToday ? colors.accent : colors.ink },
                    !on && isToday && styles.streakToday,
                  ]}
                />
              );
            })}
          </View>
        </Tile>

        {/* 04 Skills */}
        <Tile index="04" label="Skills" style={tileSize} onPress={() => goTo('mock')}>
          {d.stats ? (
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              {SKILLS.map((s) => (
                <View key={s.key} style={styles.skillRow}>
                  <Text style={styles.skillLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <DotMeter value={Number(d.stats[s.key]) || 0} count={6} dot={5} gap={3} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.small}>
              Finish a mock interview to see how you score on each skill.
            </Text>
          )}
        </Tile>

        {/* 05 Focus */}
        <Tile index="05" label="Focus" style={tileSize} onPress={() => goTo('mock')}>
          {d.weakest ? (
            <>
              <DotText text={String(d.weakest.value)} dot={4} gap={2} />
              <Text style={[styles.strong, { marginTop: 8 }]} numberOfLines={1}>
                {d.weakest.label}
              </Text>
              <Text style={[styles.small, { marginTop: 4 }]} numberOfLines={4}>
                {d.weakest.tip}
              </Text>
            </>
          ) : (
            <>
              <DotText text="--" dot={4} gap={2} />
              <Text style={[styles.small, { marginTop: 10 }]}>
                Your weakest skill shows up here after your first mock.
              </Text>
            </>
          )}
        </Tile>

        {/* 06 Stories */}
        <Tile index="06" label="Stories" style={tileSize} onPress={() => goTo('stories')}>
          <DotText text={String(storyCount)} dot={4} gap={2} />
          <Text style={[styles.small, { marginTop: 8 }]}>
            {storyCount === 1 ? 'STAR story saved' : 'STAR stories saved'}
          </Text>
          <View style={{ flex: 1 }} />
          <Steps total={3} done={Math.min(3, Math.floor(storyCount / 2))} />
          <View style={styles.progressRow}>
            <Text style={styles.micro}>goal {STORY_GOAL}</Text>
            <Text style={styles.progressValue}>
              {Math.round(Math.min(1, storyCount / STORY_GOAL) * 100)}%
            </Text>
          </View>
        </Tile>
      </View>

      {/* 07 Trend */}
      <Tile
        index="07"
        label="Score trend"
        style={{ marginTop: GAP }}
        right={<DeltaPill value={d.trendDelta} />}
        onPress={() => goTo('you')}
      >
        <DotLine values={d.scores} width={wideInnerW} height={84} dot={3} spacing={7} />
        <Text style={[styles.small, { marginTop: 12 }]}>
          {d.scores.length < 2
            ? 'Two mock interviews draw your first line.'
            : 'Your last ' + d.scores.length + ' sessions'}
        </Text>
      </Tile>

      {/* 08 Daily question */}
      <Tile
        index="08"
        label="Question of the day"
        style={{ marginTop: GAP }}
        onPress={() => goTo('mock', { presetQuestion: question })}
      >
        <Text style={styles.question}>{question}</Text>
        <Text style={[styles.small, { marginTop: 12, color: colors.accent }]}>
          Tap to answer it in a mock
        </Text>
      </Tile>

      {/* 09 Plan */}
      {entitlements ? (
        <Tile
          index="09"
          label="Plan"
          style={{ marginTop: GAP }}
          right={
            <View style={styles.pill}>
              <Text style={styles.pillText}>{entitlements.plan_name}</Text>
            </View>
          }
          onPress={() => navigation.navigate('Upgrade')}
        >
          {entitlements.research_limit == null ? (
            <Text style={styles.strong}>Unlimited organisation research</Text>
          ) : (
            <>
              <Text style={styles.strong}>
                {Math.max(0, entitlements.research_limit - entitlements.research_used)} of{' '}
                {entitlements.research_limit} research credits left
              </Text>
              <View style={{ marginTop: 12 }}>
                <DotMeter
                  value={
                    (Math.max(0, entitlements.research_limit - entitlements.research_used) /
                      Math.max(1, entitlements.research_limit)) *
                    100
                  }
                  count={Math.min(entitlements.research_limit, 20)}
                  dot={7}
                  gap={5}
                />
              </View>
            </>
          )}
          <Text style={[styles.small, { marginTop: 12, color: colors.accent }]}>
            {entitlements.plan_id === 'free' ? 'Tap to see Pro' : 'Manage your plan'}
          </Text>
        </Tile>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>WALK IN READY </Text>
        <Blink size={12} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 22,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.mute,
  },
  errorBar: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.field,
    padding: 12,
    marginBottom: GAP,
  },
  errorText: { fontFamily: fonts.mono, fontSize: 12, color: colors.accent },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  strong: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.mute,
  },
  micro: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.mute,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.ink },
  streakGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 7 * 8 + 6 * 6,
    gap: 6,
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dotOff,
  },
  streakToday: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.mute,
    marginRight: 6,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressValue: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.accent,
  },
  question: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.faint,
  },
});
