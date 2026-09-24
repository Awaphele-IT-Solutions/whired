import { useCallback, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

// Everything the home dashboard needs, in one round trip.
export function useDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    error: null,
    sessions: [],
    storyCount: 0,
  });

  const reload = useCallback(async () => {
    if (!user) return;
    const [sessionsRes, storiesRes] = await Promise.all([
      supabase
        .from('interview_sessions')
        .select('id, created_at, score, stats, category, company, role')
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('star_stories').select('id', { count: 'exact', head: true }),
    ]);
    const failure = sessionsRes.error || storiesRes.error;
    setState({
      loading: false,
      error: failure ? failure.message : null,
      sessions: sessionsRes.data ?? [],
      storyCount: storiesRes.count ?? 0,
    });
  }, [user]);

  return { ...state, reload };
}
