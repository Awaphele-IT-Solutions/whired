import { addDays, daysBetween, parseDayKey, startOfToday, toDayKey } from './dates';

export const SKILLS = [
  { key: 'communication', label: 'Communication', tip: 'Lead with the answer, then back it with one concrete example.' },
  { key: 'relevance', label: 'Relevance', tip: 'Tie every answer back to what the role actually needs.' },
  { key: 'confidence', label: 'Confidence', tip: 'Cut hedging words. State what you did and what changed.' },
  { key: 'clarity', label: 'Clarity', tip: 'Aim for three points, each in one or two sentences.' },
];

// sessions: newest first, each with created_at.
export function computeStreak(sessions) {
  const days = new Set(sessions.map((s) => toDayKey(new Date(s.created_at))));
  const today = startOfToday();
  const doneToday = days.has(toDayKey(today));

  // A streak stays alive until a full day is missed, so start from
  // yesterday when there is nothing logged yet today.
  let cursor = doneToday ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const last14 = Array.from({ length: 14 }, (_, i) =>
    days.has(toDayKey(addDays(today, i - 13)))
  );
  return { streak, doneToday, last14 };
}

// Oldest to newest, so it can be drawn left to right.
export function scoreSeries(sessions, n = 10) {
  return sessions
    .filter((s) => typeof s.score === 'number')
    .slice(0, n)
    .map((s) => s.score)
    .reverse();
}

export function latestStats(sessions) {
  const withStats = sessions.find((s) => s.stats && typeof s.stats === 'object');
  return withStats ? withStats.stats : null;
}

export function weakestSkill(stats) {
  if (!stats) return null;
  let weakest = null;
  for (const skill of SKILLS) {
    const value = Number(stats[skill.key]);
    if (Number.isFinite(value) && (weakest === null || value < weakest.value)) {
      weakest = { ...skill, value };
    }
  }
  return weakest;
}

export function daysUntil(dayKey) {
  const date = parseDayKey(dayKey);
  if (!date) return null;
  return daysBetween(startOfToday(), date);
}

// 0..1: how much of the time between signing up and the interview has passed.
export function prepProgress(profile) {
  if (!profile?.interview_date || !profile?.created_at) return 0;
  const end = parseDayKey(profile.interview_date);
  if (!end) return 0;
  const created = new Date(profile.created_at);
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const total = daysBetween(start, end);
  if (total <= 0) return 1;
  const elapsed = daysBetween(start, startOfToday());
  return Math.max(0, Math.min(1, elapsed / total));
}

export function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}
