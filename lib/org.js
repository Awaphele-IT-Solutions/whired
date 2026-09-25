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

function asObject(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value;
  return null;
}

async function readErrorBody(error) {
  if (!error) return null;
  if (error.details && typeof error.details === 'object') return error.details;
  const ctx = error.context;
  if (!ctx) return asObject(error.message);
  try {
    if (typeof ctx.json === 'function') return asObject(await ctx.json());
  } catch {
    // body already consumed by supabase-js
  }
  try {
    if (typeof ctx.text === 'function') return asObject(await ctx.text());
  } catch {
    // ignore
  }
  return asObject(error.message);
}

function fail(code, detail) {
  const err = new Error('research failed');
  err.code = code;
  err.detail = detail;
  return err;
}

// Runs (or reuses) research. Throws Error with .code set to one of:
// RESEARCH_LIMIT, DAILY_LIMIT, AI_BUSY, SIGNED_OUT, BAD_NAME, FAILED.
export async function requestResearch({ orgName, roleFocus, refresh = false }) {
  const { data, error } = await supabase.functions.invoke('research', {
    body: { org_name: orgName, role_focus: roleFocus || undefined, refresh },
  });

  // Newer supabase-js still puts a parsed body on `data` even when `error` is set.
  const payload = asObject(data) || (await readErrorBody(error));
  if (payload?.research?.id) return payload;

  if (error || payload?.error) {
    const status = error?.context?.status;
    const detail = payload || {};
    if (status === 402 || detail.error === 'research_limit') throw fail('RESEARCH_LIMIT', detail);
    if (status === 429 || detail.error === 'daily_limit') throw fail('DAILY_LIMIT', detail);
    if (status === 503 || detail.error === 'ai_unavailable') throw fail('AI_BUSY', detail);
    if (status === 401 || detail.error === 'unauthorized') throw fail('SIGNED_OUT', detail);
    if (status === 400 || detail.error === 'bad_org_name') throw fail('BAD_NAME', detail);
    throw fail('FAILED', detail);
  }

  throw fail('FAILED', { message: 'The research call returned no brief.' });
}

export function describeResearchError(err) {
  const detail = err?.detail;
  const attempts = Array.isArray(detail?.attempts) ? detail.attempts.filter(Boolean) : [];
  const reason = detail?.reason || detail?.message;

  switch (err?.code) {
    case 'DAILY_LIMIT':
      return "You've reached today's AI allowance. It resets tomorrow.";
    case 'AI_BUSY':
      if (attempts.length) {
        return `Research providers failed. Nothing was used.\n${attempts.slice(0, 3).join('\n')}`;
      }
      if (reason && reason !== 'all_providers_failed' && reason !== 'no_provider_available') {
        return `Research failed: ${reason}. Nothing was used.`;
      }
      return 'The research service is busy right now. Nothing was used. Try again in a minute.';
    case 'SIGNED_OUT':
      return 'Your session expired. Sign in again to continue.';
    case 'BAD_NAME':
      return 'Enter the name of an organisation.';
    default:
      if (reason) return `Couldn't complete the research: ${reason}. Nothing was used.`;
      if (attempts.length) return `Couldn't complete the research.\n${attempts.slice(0, 3).join('\n')}`;
      return "Couldn't complete the research. Nothing was used. Check your connection and try again.";
  }
}
