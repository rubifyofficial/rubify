import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const INCOMING_CALL_MAX_AGE_MS = 45_000;
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

type SendCallNotificationRequest = {
  callRecordId?: string;
};

type CoupleCallRecord = {
  id: string;
  caller_id: string;
  recipient_id: string;
  stream_call_id: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'cancelled' | 'ended';
  created_at: string;
};

type CallerProfile = {
  id: string;
  name?: string | null;
};

type PushTokenRow = {
  expo_push_token: string;
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const isCallRecent = (createdAt?: string | null) => {
  if (!createdAt) return false;
  const createdAtTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtTime)) return false;
  return Date.now() - createdAtTime <= INCOMING_CALL_MAX_AGE_MS;
};

const isExpoPushToken = (value: string) => /^ExponentPushToken\[[^\]]+\]$/.test(value);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Push notification setup is missing.' }, 500);
    }

    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: SendCallNotificationRequest | null = null;
    try {
      body = (await req.json()) as SendCallNotificationRequest;
    } catch {
      body = null;
    }

    const callRecordId = normalizeOptionalText(body?.callRecordId);
    if (!callRecordId) {
      return jsonResponse({ error: 'Invalid call notification request.' }, 400);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const [
      { data: profileData, error: profileError },
      { data: callData, error: callError },
    ] = await Promise.all([
      authClient.rpc('get_my_profile'),
      adminClient
        .from('couple_calls')
        .select('id, caller_id, recipient_id, stream_call_id, call_type, status, created_at')
        .eq('id', callRecordId)
        .maybeSingle(),
    ]);

    if (profileError || callError || !callData) {
      return jsonResponse({ error: 'Call notification lookup failed.' }, 500);
    }

    const callerProfile = (Array.isArray(profileData) ? profileData[0] : profileData) as CallerProfile | null;
    const callRecord = callData as CoupleCallRecord;

    if (callRecord.caller_id !== user.id) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    if (
      callRecord.status !== 'ringing' ||
      !callRecord.recipient_id ||
      !callRecord.stream_call_id ||
      !isCallRecent(callRecord.created_at)
    ) {
      return jsonResponse({ sent: true, recipientTokenCount: 0 }, 200);
    }

    const { data: tokenRows, error: tokenError } = await adminClient
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', callRecord.recipient_id);

    if (tokenError) {
      return jsonResponse({ error: 'Push token lookup failed.' }, 500);
    }

    const expoPushTokens = Array.from(
      new Set(
        (tokenRows ?? [])
          .map((row) => normalizeOptionalText((row as PushTokenRow).expo_push_token))
          .filter((value): value is string => Boolean(value && isExpoPushToken(value)))
      )
    );

    if (expoPushTokens.length === 0) {
      return jsonResponse({ sent: true, recipientTokenCount: 0 }, 200);
    }

    const callerName = normalizeOptionalText(callerProfile?.name) ?? 'Tu pareja';
    const isVideoCall = callRecord.call_type === 'video';
    const title = isVideoCall ? 'Videollamada entrante' : 'Llamada entrante';
    const bodyText = isVideoCall
      ? `${callerName} quiere hacer una videollamada contigo`
      : `${callerName} te está llamando`;

    const pushMessages = expoPushTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: bodyText,
      priority: 'high',
      channelId: 'incoming-calls',
      data: {
        type: 'incoming_call',
        callRecordId: callRecord.id,
        streamCallId: callRecord.stream_call_id,
        callType: callRecord.call_type,
      },
    }));

    const expoResponse = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessages),
    });

    if (!expoResponse.ok) {
      console.log('[send-call-notification] expo push send failed', {
        status: expoResponse.status,
      });
      return jsonResponse({ error: 'Push delivery failed.' }, 502);
    }

    const expoPayload = (await expoResponse.json()) as {
      data?: Array<{
        status?: string;
        details?: { error?: string };
      }>;
    };

    const invalidTokens = expoPushTokens.filter((token, index) => {
      const entry = expoPayload.data?.[index];
      return entry?.status === 'error' && entry.details?.error === 'DeviceNotRegistered';
    });

    if (invalidTokens.length > 0) {
      await adminClient.from('push_tokens').delete().in('expo_push_token', invalidTokens);
    }

    console.log('[send-call-notification] push sent', {
      recipientTokenCount: expoPushTokens.length,
      invalidTokenCount: invalidTokens.length,
    });

    return jsonResponse(
      {
        sent: true,
        recipientTokenCount: expoPushTokens.length,
      },
      200
    );
  } catch (error) {
    console.log('[send-call-notification] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: 'Push delivery failed.' }, 500);
  }
});
