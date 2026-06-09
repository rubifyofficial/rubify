import { StreamVideoClient } from '@stream-io/video-react-native-sdk';
import { getSafeUser, supabase } from './supabase';

let cachedStreamClient: StreamVideoClient | null = null;
let cachedUserId: string | null = null;

export const getStreamVideoClient = async () => {
  const user = await getSafeUser();

  if (!user) {
    console.log('getStreamVideoClient user error: missing user');
    return null;
  }

  if (cachedStreamClient && cachedUserId === user.id) {
    return cachedStreamClient;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, name, avatar_url, photo_url')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.log('getStreamVideoClient profile error:', profileError);
  }

  const { data, error } = await supabase.functions.invoke('stream-token');

  if (error) {
    console.log('stream-token invoke error:', error);
    throw error;
  }

  if (!data?.apiKey || !data?.token) {
    throw new Error('Stream token response missing apiKey/token');
  }

  const streamUser = {
    id: user.id,
    name: profile?.full_name || profile?.name || 'Usfully',
    image: profile?.avatar_url || profile?.photo_url || undefined,
  };

  cachedStreamClient = StreamVideoClient.getOrCreateInstance({
    apiKey: data.apiKey,
    user: streamUser,
    token: data.token,
  });

  cachedUserId = user.id;

  return cachedStreamClient;
};

export const resetStreamVideoClient = async () => {
  try {
    if (cachedStreamClient) {
      await cachedStreamClient.disconnectUser?.();
    }
  } catch (error) {
    console.log('disconnect stream client ignored:', error);
  } finally {
    cachedStreamClient = null;
    cachedUserId = null;
  }
};
