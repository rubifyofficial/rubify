import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useRouter, useSegments } from 'expo-router';

function isInvalidRefreshTokenError(error: unknown) {
  const message = typeof (error as any)?.message === 'string' ? (error as any).message : '';
  return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found');
}

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  hasCouple: boolean;
  refreshCouple: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  hasCouple: false,
  refreshCouple: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCouple, setHasCouple] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const handledInvalidRefresh = useRef(false);

  // Fetch couple status from Supabase RPC
  const fetchCouple = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_couple');
      if (error) {
        console.log('[AuthProvider] get_my_couple error:', error);
        setHasCouple(false);
      } else {
        // data may be null, an object, or an array depending on RPC return type
        const coupleId =
          data?.couple_id ??
          (Array.isArray(data) && data[0]?.couple_id) ??
          null;
        console.log('[AuthProvider] couple data:', data, '| couple_id:', coupleId);
        setHasCouple(!!coupleId);
      }
    } catch (e) {
      console.log('[AuthProvider] fetchCouple exception:', e);
      setHasCouple(false);
    }
  }, []);

  // Public refresh so PartnerSetup screen can trigger a re-check
  const refreshCouple = useCallback(async () => {
    await fetchCouple();
  }, [fetchCouple]);

  useEffect(() => {
    const clearLocalSession = async (error?: unknown) => {
      if (handledInvalidRefresh.current) return;
      handledInvalidRefresh.current = true;

      if (error) {
        console.warn('[AuthProvider] Invalid refresh token. Clearing local session.');
      }

      try {
        await (supabase.auth as any).signOut({ scope: 'local' });
      } catch {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }

      setSession(null);
      setHasCouple(false);
      setLoading(false);
    };

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error && isInvalidRefreshTokenError(error) && !data.session) {
          await clearLocalSession(error);
          return;
        }

        setSession(data.session);
        if (data.session) {
          await fetchCouple();
        }
        setLoading(false);
      } catch (e) {
        if (isInvalidRefreshTokenError(e)) {
          await clearLocalSession(e);
          return;
        }
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session && _event === 'SIGNED_OUT') {
        setSession(null);
        setHasCouple(false);
        setLoading(false);
        return;
      }

      setSession(session);
      if (session) {
        await fetchCouple();
      } else {
        setHasCouple(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchCouple]);

  // Navigation guard
  useEffect(() => {
    if (loading) return;

    const inAuthGroup    = segments[0] === '(auth)';
    const inPartnerSetup = segments[0] === 'partner-setup';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      if (hasCouple) {
        router.replace('/(tabs)');
      } else {
        router.replace('/partner-setup');
      }
    } else if (session && !hasCouple && !inPartnerSetup && !inAuthGroup) {
      router.replace('/partner-setup');
    } else if (session && hasCouple && inPartnerSetup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, hasCouple, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080808' }}>
        <ActivityIndicator size="large" color="#EF233C" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ session, loading, hasCouple, refreshCouple }}>
      {children}
    </AuthContext.Provider>
  );
}
