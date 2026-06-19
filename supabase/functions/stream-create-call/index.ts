import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamClient } from 'npm:@stream-io/node-sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });

type StreamCreateCallRequest = {
  callId?: string;
  callType?: 'audio' | 'video';
  recipientId?: string;
  recipientName?: string;
  recipientImage?: string | null;
};

type CallerProfile = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
};

type CallerCouple = {
  couple_id: string;
  partner_id: string;
  partner_name?: string | null;
  partner_avatar_url?: string | null;
};

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const streamApiKey = Deno.env.get('STREAM_API_KEY');
    const streamApiSecret = Deno.env.get('STREAM_API_SECRET');
    const authHeader = req.headers.get('Authorization');

    let body: StreamCreateCallRequest | null = null;
    try {
      body = (await req.json()) as StreamCreateCallRequest;
    } catch {
      body = null;
    }

    const callId = normalizeOptionalText(body?.callId);
    const callType = body?.callType;
    const recipientId = normalizeOptionalText(body?.recipientId);

    console.log('[stream-create-call] request', {
      hasAuthorization: Boolean(authHeader),
      hasCallId: Boolean(callId),
      callType: callType ?? null,
      hasRecipientId: Boolean(recipientId),
    });

    console.log('[stream-create-call] configuration', {
      hasStreamApiKey: Boolean(streamApiKey),
      hasStreamApiSecret: Boolean(streamApiSecret),
    });

    if (!supabaseUrl || !supabaseAnonKey || !streamApiKey || !streamApiSecret) {
      return jsonResponse({ error: 'Missing Stream server configuration' }, 500);
    }

    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!callId || (callType !== 'audio' && callType !== 'video') || !recipientId) {
      return jsonResponse({ error: 'Invalid call request' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const [{ data: profileData, error: profileError }, { data: coupleData, error: coupleError }] = await Promise.all([
      supabase.rpc('get_my_profile'),
      supabase.rpc('get_my_couple'),
    ]);

    if (profileError || coupleError) {
      return jsonResponse({ error: 'Couple validation failed' }, 500);
    }

    const callerProfile = (Array.isArray(profileData) ? profileData[0] : profileData) as CallerProfile | null;
    const callerCouple = (Array.isArray(coupleData) ? coupleData[0] : coupleData) as CallerCouple | null;

    if (!callerCouple?.couple_id || !callerCouple.partner_id || callerCouple.partner_id !== recipientId) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const callerId = user.id;
    const callerName = normalizeOptionalText(callerProfile?.name) ?? 'Usuario';
    const callerImage = normalizeOptionalText(callerProfile?.avatar_url);
    const safeRecipientName =
      normalizeOptionalText(body?.recipientName) ??
      normalizeOptionalText(callerCouple.partner_name) ??
      'Pareja';
    const safeRecipientImage =
      normalizeOptionalText(body?.recipientImage) ??
      normalizeOptionalText(callerCouple.partner_avatar_url);

    try {
      const streamClient = new StreamClient(streamApiKey, streamApiSecret);

      await streamClient.upsertUsers([
        {
          id: callerId,
          name: callerName,
          image: callerImage,
        },
        {
          id: recipientId,
          name: safeRecipientName,
          image: safeRecipientImage,
        },
      ]);

      console.log('[stream-create-call] users upserted', {
        callerId,
        recipientId,
      });

      return jsonResponse(
        {
          usersReady: true,
        },
        200
      );
    } catch (error) {
      console.log('[stream-create-call] create failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return jsonResponse({ error: 'Stream user preparation failed' }, 500);
    }
  } catch (error) {
    console.log('[stream-create-call] unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: 'Unexpected function error' }, 500);
  }
});
