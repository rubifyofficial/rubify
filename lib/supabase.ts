import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.');
}

const globalForSupabase = globalThis as unknown as {
  __usfullySupabase?: SupabaseClient;
};

export const supabase: SupabaseClient =
  globalForSupabase.__usfullySupabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

globalForSupabase.__usfullySupabase = supabase;

export function isInvalidRefreshTokenError(error: unknown) {
  const message = String((error as any)?.message ?? '').toLowerCase();
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('refresh token already used') ||
    message.includes('already used') ||
    message.includes('auth session missing')
  );
}

async function signOutLocalSafe() {
  try {
    await (supabase.auth as any).signOut({ scope: 'local' });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

export async function getSafeSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log('[Supabase] getSession error:', error);
      if (isInvalidRefreshTokenError(error)) {
        await signOutLocalSafe();
        return null;
      }
      return null;
    }
    return data?.session ?? null;
  } catch (error) {
    console.log('[Supabase] getSession catch:', error);
    if (isInvalidRefreshTokenError(error)) {
      await signOutLocalSafe();
    }
    return null;
  }
}

export async function getSafeUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.log('[Supabase] getUser error:', error);
      if (isInvalidRefreshTokenError(error)) {
        await signOutLocalSafe();
      }
      return null;
    }
    return data?.user ?? null;
  } catch (error) {
    console.log('[Supabase] getUser catch:', error);
    if (isInvalidRefreshTokenError(error)) {
      await signOutLocalSafe();
    }
    return null;
  }
}
