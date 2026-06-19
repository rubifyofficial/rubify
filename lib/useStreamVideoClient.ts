import React from 'react';
import { StreamVideoClient, type User } from '@stream-io/video-react-native-sdk';
import { getSafeUser, isInvalidRefreshTokenError, supabase } from './supabase';
import { getStreamApiKey } from './streamVideo';

type StreamTokenResponse = {
  token: string;
  apiKey: string;
  userId?: string;
};

type ProfileRow = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
} | null;

const readFunctionErrorBody = async (context: unknown) => {
  if (!context || typeof context !== 'object') {
    return '';
  }

  const maybeResponse = context as {
    text?: () => Promise<string>;
    clone?: () => { text?: () => Promise<string> };
  };

  try {
    if (typeof maybeResponse.clone === 'function') {
      const cloned = maybeResponse.clone();
      if (cloned && typeof cloned.text === 'function') {
        return (await cloned.text()).trim();
      }
    }

    if (typeof maybeResponse.text === 'function') {
      return (await maybeResponse.text()).trim();
    }
  } catch (error) {
    console.warn('[StreamToken] Could not read function error response body:', error);
  }

  return '';
};

export function useStreamVideoClientForUsfully() {
  const [client, setClient] = React.useState<StreamVideoClient | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        const streamApiKey = getStreamApiKey();

        const user = await getSafeUser();
        if (!user) {
          if (mounted) setClient(null);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, photo_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.log('stream client profile fetch error:', profileError);
        }

        const profile = (profileData as ProfileRow) ?? null;

        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('stream-token', {
          body: {},
        });
        if (tokenError) {
          const safeResponseText = await readFunctionErrorBody((tokenError as any)?.context);

          console.log('[StreamToken] Edge Function invoke failed', {
            name: (tokenError as any)?.name ?? null,
            message: (tokenError as any)?.message ?? String(tokenError),
            safeResponseText: safeResponseText || null,
          });

          throw new Error(
            `Stream token failed: ${(tokenError as any)?.message ?? String(tokenError)}${
              safeResponseText ? ` | ${safeResponseText}` : ''
            }`
          );
        }

        const payload = tokenData as StreamTokenResponse;
        const token = payload?.token;
        const userId = payload?.userId;

        if (!payload?.apiKey || !token || !userId) {
          throw new Error('Missing Stream token payload.');
        }

        const streamUser: User = {
          id: user.id,
          name: profile?.name || 'Usfully',
          image: profile?.avatar_url || profile?.photo_url || undefined,
        };

        console.log('[StreamConfig] API key availability', {
          hasStreamApiKey: Boolean(process.env.EXPO_PUBLIC_STREAM_API_KEY?.trim()),
        });

        const streamClient = StreamVideoClient.getOrCreateInstance({
          apiKey: streamApiKey,
          user: streamUser,
          token,
        });

        if (mounted) setClient(streamClient);
      } catch (err) {
        console.log('stream client setup error:', err);
        if (isInvalidRefreshTokenError(err)) {
          if (mounted) setClient(null);
          return;
        }
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setup();

    return () => {
      mounted = false;
    };
  }, []);

  return { client, loading, error };
}
