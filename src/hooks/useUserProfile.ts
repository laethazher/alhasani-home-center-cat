import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type UserProfile } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface UseAuthReturn {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signingOut: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useUserProfile(): UseAuthReturn {
  const [user, setUser]             = useState<User | null>(null);
  const [profile, setProfile]       = useState<UserProfile | null>(null);
  const [session, setSession]       = useState<Session | null>(null);
  const [loading, setLoading]       = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  /* Prevent state updates after unmount */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role, created_at')
        .eq('id', uid)
        .single();

      if (error) {
        console.error('[auth] profile fetch error:', error.message);
        if (mounted.current) setProfile(null);
        return;
      }
      if (mounted.current) setProfile(data as UserProfile);
    } catch (err) {
      console.error('[auth] unexpected profile error:', err);
      if (mounted.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    /* 1. Initial session check */
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted.current) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => {
          if (mounted.current) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    /* 2. Auth state listener */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (!mounted.current) return;
        setSession(s);
        setUser(s?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setSigningOut(false);
          return;
        }
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  /* Double-click safe sign out */
  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[auth] sign out error:', err);
    } finally {
      if (mounted.current) {
        setUser(null);
        setProfile(null);
        setSession(null);
        setSigningOut(false);
      }
    }
  }, [signingOut]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  return { user, profile, session, loading, signingOut, signOut, refreshProfile };
}
