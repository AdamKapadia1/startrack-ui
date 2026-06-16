import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

const NOT_CONFIGURED = { data: null, error: { message: 'Auth not configured' } as any };

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUp = (email: string, password: string) =>
    supabase ? supabase.auth.signUp({ email, password }) : Promise.resolve(NOT_CONFIGURED);

  const signIn = (email: string, password: string) =>
    supabase ? supabase.auth.signInWithPassword({ email, password }) : Promise.resolve(NOT_CONFIGURED);

  const signOut = () =>
    supabase ? supabase.auth.signOut() : Promise.resolve({ error: null });

  const resetPassword = (email: string) =>
    supabase
      ? supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      : Promise.resolve(NOT_CONFIGURED);

  return { user, loading, signUp, signIn, signOut, resetPassword };
}
