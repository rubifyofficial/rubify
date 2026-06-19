import { StreamVideoClient } from '@stream-io/video-react-native-sdk';
import { getSafeUser, supabase, supabaseUrl } from './supabase';

let cachedStreamClient: StreamVideoClient | null = null;
let cachedUserId: string | null = null;
const MESSAGES_CALL_DEBUG_URL = 'http://192.168.100.35:7777/event';
const MESSAGES_CALL_DEBUG_SESSION = 'mensajes-call-startup';

type StreamTokenResponse = {
  apiKey?: string;
  token?: string;
  userId?: string;
};

type StreamPrepareUsersResponse = {
  usersReady?: boolean;
};

type CallSetupError = Error & {
  userMessage?: string;
};

export function getStreamApiKey(): string {
  const streamApiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY;

  if (!streamApiKey?.trim()) {
    throw new Error('Missing EXPO_PUBLIC_STREAM_API_KEY');
  }

  return streamApiKey.trim();
}

const reportMessagesCallDebug = (hypothesisId: string, location: string, msg: string, data?: Record<string, unknown>) => {
  void fetch(MESSAGES_CALL_DEBUG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: MESSAGES_CALL_DEBUG_SESSION,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
};

const createCallSetupError = (technicalMessage: string, userMessage: string) => {
  const error = new Error(technicalMessage) as CallSetupError;
  error.userMessage = userMessage;
  return error;
};

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

const mapStreamTokenErrorToUserMessage = (technicalMessage: string) => {
  const normalized = technicalMessage.toLowerCase();

  if (
    normalized.includes('missing stream server configuration') ||
    normalized.includes('missing stream_api_key') ||
    normalized.includes('missing stream_api_secret')
  ) {
    return 'No se pudo configurar el servicio de llamadas.';
  }

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('missing authorization header') ||
    normalized.includes('jwt') ||
    normalized.includes('session')
  ) {
    return 'Tu sesión no está disponible. Inténtalo de nuevo.';
  }

  if (
    normalized.includes('token generation failed') ||
    normalized.includes('stream token failed') ||
    normalized.includes('function runtime error')
  ) {
    return 'No se pudo conectar al servicio de llamadas.';
  }

  return 'No se pudo iniciar la llamada. Inténtalo de nuevo.';
};

const mapStreamPrepareUsersErrorToUserMessage = (technicalMessage: string) => {
  const normalized = technicalMessage.toLowerCase();

  if (
    normalized.includes('forbidden') ||
    normalized.includes('unauthorized') ||
    normalized.includes('session') ||
    normalized.includes('jwt') ||
    normalized.includes('invalid call request') ||
    normalized.includes('missing stream server configuration') ||
    normalized.includes('stream call creation failed') ||
    normalized.includes('function runtime error')
  ) {
    return 'No se pudo preparar la llamada. Inténtalo de nuevo.';
  }

  return 'No se pudo preparar la llamada. Inténtalo de nuevo.';
};

export const prepareMessagesStreamUsers = async ({
  recipientId,
  recipientName,
  recipientImage,
}: {
  recipientId: string;
  recipientName?: string;
  recipientImage?: string | null;
}) => {
  const { data, error } = await supabase.functions.invoke('stream-create-call', {
    body: {
      recipientId,
      recipientName,
      recipientImage,
    },
  });

  if (error) {
    const safeResponseText = await readFunctionErrorBody((error as any)?.context);
    const technicalMessage = `Stream prepare users failed: ${(error as any)?.message ?? String(error)}${
      safeResponseText ? ` | ${safeResponseText}` : ''
    }`;

    console.log('[StreamCreateCall] Edge Function invoke failed', {
      name: (error as any)?.name ?? null,
      message: (error as any)?.message ?? String(error),
      safeResponseText: safeResponseText || null,
    });

    throw createCallSetupError(technicalMessage, mapStreamPrepareUsersErrorToUserMessage(technicalMessage));
  }

  const payload = (data ?? {}) as StreamPrepareUsersResponse;

  if (payload.usersReady !== true) {
    throw createCallSetupError(
      'Stream prepare users response missing usersReady',
      'No se pudo preparar la llamada.'
    );
  }

  return payload;
};

export const getStreamVideoClient = async () => {
  const user = await getSafeUser();
  let streamApiKey: string;

  try {
    streamApiKey = getStreamApiKey();
  } catch (error) {
    throw createCallSetupError(
      error instanceof Error ? error.message : 'Missing EXPO_PUBLIC_STREAM_API_KEY',
      'No se pudo configurar el servicio de llamadas.'
    );
  }

  // #region debug-point C:get-stream-user
  reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:user', '[DEBUG] stage: fetch-stream-user', {
    hasUser: Boolean(user),
    cachedForSameUser: Boolean(cachedStreamClient && cachedUserId === user?.id),
  });
  // #endregion

  if (!user) {
    // #region debug-point C:get-stream-user-missing
    reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:missing-user', '[DEBUG] startup failed', {
      stage: 'fetch-stream-user',
      message: 'missing user',
    });
    // #endregion
    console.log('getStreamVideoClient user error: missing user');
    return null;
  }

  if (cachedStreamClient && cachedUserId === user.id) {
    // #region debug-point C:get-stream-client-cache-hit
    reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:cache-hit', '[DEBUG] stage: connect-stream-client cache-hit', {
      userId: user.id,
    });
    // #endregion
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

  // #region debug-point C:fetch-stream-token
  console.log('[MessagesCall] requesting stream token');
  reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:invoke-stream-token', '[DEBUG] stage: fetch-stream-token', {
    hasProfile: Boolean(profile),
    userId: user.id,
  });
  // #endregion
  console.log('[StreamToken] invoking function', {
    functionName: 'stream-token',
    supabaseProjectRef: new URL(String(supabaseUrl)).hostname.split('.')[0],
  });
  const { data, error } = await supabase.functions.invoke('stream-token', {
    body: {},
  });

  if (error) {
    const safeResponseText = await readFunctionErrorBody((error as any)?.context);
    const technicalMessage = `Stream token failed: ${(error as any)?.message ?? String(error)}${
      safeResponseText ? ` | ${safeResponseText}` : ''
    }`;
    const userMessage = mapStreamTokenErrorToUserMessage(technicalMessage);

    // #region debug-point C:fetch-stream-token-failed
    reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:invoke-stream-token-failed', '[DEBUG] startup failed', {
      stage: 'fetch-stream-token',
      message: technicalMessage,
      name: (error as any)?.name ?? null,
      hasResponseBody: Boolean(safeResponseText),
    });
    // #endregion
    console.log('[StreamToken] Edge Function invoke failed', {
      name: (error as any)?.name ?? null,
      message: (error as any)?.message ?? String(error),
      safeResponseText: safeResponseText || null,
    });
    throw createCallSetupError(technicalMessage, userMessage);
  }

  const payload = (data ?? {}) as StreamTokenResponse;

  if (!payload.apiKey || !payload.token || !payload.userId) {
    // #region debug-point C:fetch-stream-token-missing-fields
    reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:missing-token-fields', '[DEBUG] startup failed', {
      stage: 'fetch-stream-token',
      hasApiKey: Boolean(payload.apiKey),
      hasToken: Boolean(payload.token),
      streamUserId: payload.userId ?? null,
    });
    // #endregion
    throw createCallSetupError(
      'Stream token response missing apiKey/token',
      'No se pudo conectar al servicio de llamadas.'
    );
  }

  // #region debug-point C:fetch-stream-token-success
  console.log('[MessagesCall] stream token result', {
    hasToken: Boolean(payload.token),
    hasStreamUserId: Boolean(payload.userId),
  });
  reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:stream-token-success', '[DEBUG] stage: fetch-stream-token success', {
    hasApiKey: Boolean(payload.apiKey),
    hasToken: Boolean(payload.token),
    streamUserId: payload.userId ?? null,
  });
  // #endregion

  const streamUser = {
    id: user.id,
    name: profile?.full_name || profile?.name || 'Usfully',
    image: profile?.avatar_url || profile?.photo_url || undefined,
  };

  console.log('[StreamConfig] API key availability', {
    hasStreamApiKey: Boolean(process.env.EXPO_PUBLIC_STREAM_API_KEY?.trim()),
  });

  cachedStreamClient = StreamVideoClient.getOrCreateInstance({
    apiKey: streamApiKey,
    user: streamUser,
    token: payload.token,
  });

  // #region debug-point C:connect-stream-client-success
  reportMessagesCallDebug('C', 'streamVideo.ts:getStreamVideoClient:client-created', '[DEBUG] stage: connect-stream-client success', {
    userId: user.id,
    hasImage: Boolean(streamUser.image),
    hasName: Boolean(streamUser.name),
  });
  // #endregion

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
