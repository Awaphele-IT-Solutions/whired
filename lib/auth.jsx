import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { identifyBillingUser, resetBillingUser } from './billing';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.warn('Could not load profile:', error.message);
    setProfile(data ?? null);
  }, []);

  const refreshEntitlements = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_entitlements');
    if (error) {
      console.warn('Could not load plan:', error.message);
      return null;
    }
    setEntitlements(data ?? null);
    return data ?? null;
  }, []);

  const loadAccountExtras = useCallback(
    async (userId) => {
      const [, adminRes] = await Promise.all([
        refreshEntitlements(),
        supabase.rpc('is_admin'),
      ]);
      setIsAdmin(adminRes?.data === true);
      identifyBillingUser(userId);
    },
    [refreshEntitlements]
  );

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) {
        await Promise.all([
          loadProfile(data.session.user.id),
          loadAccountExtras(data.session.user.id),
        ]);
      }
      if (alive) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next) {
        // Defer: awaiting Supabase calls inside this callback can deadlock.
        // Token refreshes and MFA upgrades don't need a full reload.
        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            loadProfile(next.user.id);
            loadAccountExtras(next.user.id);
          }, 0);
        }
      } else {
        setProfile(null);
        setEntitlements(null);
        setIsAdmin(false);
        resetBillingUser();
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, loadAccountExtras]);

  const updateProfile = useCallback(
    async (patch) => {
      if (!session) return { error: new Error('Not signed in') };
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, ...patch })
        .select()
        .single();
      if (!error) setProfile(data);
      return { data, error };
    },
    [session]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) return { error };
    await supabase.auth.signOut({ scope: 'local' });
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      entitlements,
      isAdmin,
      refreshEntitlements,
      updateProfile,
      signOut,
      deleteAccount,
    }),
    [ready, session, profile, entitlements, isAdmin, refreshEntitlements, updateProfile, signOut, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
