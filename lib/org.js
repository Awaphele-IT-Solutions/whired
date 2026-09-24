import { supabase } from './supabase';

// Same steps and output as supabase/functions/_shared/org.ts (both tested).
const SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'limited', 'pty', 'plc', 'corp', 'corporation', 'co',
  'gmbh', 'sa', 'ag', 'bv', 'nv', 'pvt', 'holdings', 'group',
]);

export function normalizeOrg(name) {
  let s = String(name ?? '');
  if (typeof s.normalize === 'function') s = s.normalize('NFKD');
  s = s
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019`.]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e\s]+/g, ' ')
    .trim();
  const words = s.split(' ').filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(' ');
}

// Runs (or reuses) research. Throws Error with .code set to one of:
// RESEARCH_LIMIT, DAILY_LIMIT, AI_BUSY, SIGNED_OUT, BAD_NAME, FAILED.
export async function requestResearch({ orgName, roleFocus, refresh = false }) {
  const { data, error } = await supabase.functions.invoke('research', {
    body: { org_name: orgName, role_focus: roleFocus || undefined, refresh },
  });
  if (error) {
    const status = error.context?.status;
    let detail = null;
    try {
      detail = await error.context.json();
    } catch (e) {
      // body wasn't JSON
    }
    const err = new Error('research failed');
    err.detail = detail;
    if (status === 402) err.code = 'RESEARCH_LIMIT';
    else if (status === 429) err.code = 'DAILY_LIMIT';
    else if (status === 503) err.code = 'AI_BUSY';
    else if (status === 401) err.code = 'SIGNED_OUT';
    else if (status === 400) err.code = 'BAD_NAME';
    else err.code = 'FAILED';
    throw err;
  }
  return data;
}

export function describeResearchError(err) {
  switch (err?.code) {
    case 'DAILY_LIMIT':
      return "You've reached today's AI allowance. It resets tomorrow.";
    case 'AI_BUSY':
      return 'The research service is busy right now. Nothing was used. Try again in a minute.';
    case 'SIGNED_OUT':
      return 'Your session expired. Sign in again to continue.';
    case 'BAD_NAME':
      return 'Enter the name of an organisation.';
    default:
      return "Couldn't complete the research. Nothing was used. Check your connection and try again.";
  }
}
