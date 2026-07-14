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

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

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

const isExpoPushToken = (value: string) => /^ExponentPushToken\[[^\]]+\]$/.test(value);
const maskToken = (value: string) => (value.length <= 10 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`);

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
      return jsonResponse({ ok: false, sent: false, reason: 'missing_push_configuration' }, 500);
    }

    if (!authHeader) {
      return jsonResponse({ ok: false, sent: false, reason: 'unauthorized' }, 401);
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
      return jsonResponse({ ok: false, sent: false, reason: 'unauthorized' }, 401);
    }

    const { data: tokenRows, error: tokenError } = await adminClient
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', user.id);

    if (tokenError) {
      return jsonResponse({ ok: false, sent: false, reason: 'token_lookup_failed', details: tokenError.message }, 500);
    }

    const expoPushTokens = Array.from(
      new Set(
        (tokenRows ?? [])
          .map((row) => normalizeOptionalText((row as PushTokenRow).expo_push_token))
          .filter((value): value is string => Boolean(value && isExpoPushToken(value)))
      )
    );

    console.log('[send-test-push] token status', {
      userId: user.id,
      hasToken: expoPushTokens.length > 0,
      tokenPreview: expoPushTokens[0] ? maskToken(expoPushTokens[0]) : null,
      tokenCount: expoPushTokens.length,
    });

    if (expoPushTokens.length === 0) {
      return jsonResponse(
        {
          ok: true,
          sent: false,
          hasToken: false,
          reason: 'missing_recipient_push_token',
          expoStatus: null,
        },
        200
      );
    }

    const pushMessages = expoPushTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'Prueba de notificacion',
      body: 'Si ves esto, las notificaciones funcionan',
      priority: 'high',
      channelId: 'calls',
      data: {
        type: 'test_push',
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
      const responseBody = await expoResponse.text();
      console.log('[send-test-push] expo push send failed', {
        status: expoResponse.status,
        body: responseBody,
      });
      return jsonResponse(
        {
          ok: false,
          sent: false,
          hasToken: true,
          reason: 'expo_push_failed',
          expoStatus: String(expoResponse.status),
          details: responseBody,
        },
        502
      );
    }

    const expoPayload = await expoResponse.json();
    console.log('[send-test-push] expo response', {
      status: expoResponse.status,
      body: expoPayload,
    });

    return jsonResponse(
      {
        ok: true,
        sent: true,
        hasToken: true,
        reason: null,
        expoStatus: 'ok',
        details: expoPayload,
      },
      200
    );
  } catch (error) {
    console.log('[send-test-push] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ ok: false, sent: false, reason: 'unexpected_error' }, 500);
  }
});
