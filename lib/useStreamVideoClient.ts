import React from 'react';
import { StreamVideoClient, type User } from '@stream-io/video-react-native-sdk';
import { getSafeUser, isInvalidRefreshTokenError, supabase } from './supabase';

type StreamTokenResponse = {
  token: string;
  apiKey: string;
  userId?: string;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
} | null;

export function useStreamVideoClientForUsfully() {
  const [client, setClient] = React.useState<StreamVideoClient | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        const user = await getSafeUser();
        if (!user) {
          if (mounted) setClient(null);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, name, avatar_url, photo_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.log('stream client profile fetch error:', profileError);
        }

        const profile = (profileData as ProfileRow) ?? null;

        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('stream-token');
        if (tokenError) {
          throw tokenError;
        }

        const payload = tokenData as StreamTokenResponse;
        const apiKey = payload?.apiKey;
        const token = payload?.token;

        if (!apiKey || !token) {
          throw new Error('Missing Stream token payload.');
        }

        const streamUser: User = {
          id: user.id,
          name: profile?.full_name || profile?.name || 'Usfully',
          image: profile?.avatar_url || profile?.photo_url || undefined,
        };

        const streamClient = StreamVideoClient.getOrCreateInstance({
          apiKey,
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
