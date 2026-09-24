import { supabase } from './supabase';

// The AI interviewer runs in a Supabase Edge Function so the model API key
// never ships inside the app. See supabase/functions/interview.

async function call(body) {
  const { data, error } = await supabase.functions.invoke('interview', { body });
  if (error) {
    const status = error.context?.status;
    if (status === 429) throw new Error('DAILY_LIMIT');
    if (status === 503) throw new Error('AI_BUSY');
    if (status === 401) throw new Error('SIGNED_OUT');
    throw new Error('REQUEST_FAILED');
  }
  return data;
}

export function fetchTurn({ context, history, turnNumber }) {
  return call({ action: 'turn', context, history, turnNumber });
}

export function fetchSummary({ context, history }) {
  return call({ action: 'summary', context, history });
}

export function describeInterviewError(err) {
  switch (err?.message) {
    case 'DAILY_LIMIT':
      return "You've hit today's practice limit. It resets tomorrow.";
    case 'AI_BUSY':
      return 'The interviewer is busy right now. Try again in a minute.';
    case 'SIGNED_OUT':
      return 'Your session expired. Sign in again to continue.';
    default:
      return "Couldn't reach the interviewer. Check your connection and try again.";
  }
}
