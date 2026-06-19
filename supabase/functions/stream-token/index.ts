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

    console.log('[stream-token] request received', {
      hasAuthorization: Boolean(authHeader),
    });

    console.log('[stream-token] configuration', {
      hasStreamApiKey: Boolean(streamApiKey),
      hasStreamApiSecret: Boolean(streamApiSecret),
    });

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(
        {
          error: 'Function runtime error',
        },
        500
      );
    }

    if (!authHeader) {
      return jsonResponse(
        {
          error: 'Unauthorized',
        },
        401
      );
    }

    if (!streamApiKey) {
      return jsonResponse(
        {
          error: 'Missing Stream server configuration',
        },
        500
      );
    }

    if (!streamApiSecret) {
      return jsonResponse(
        {
          error: 'Missing Stream server configuration',
        },
        500
      );
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
      return jsonResponse(
        {
          error: 'Unauthorized',
        },
        401
      );
    }

    try {
      const streamClient = new StreamClient(streamApiKey, streamApiSecret);
      const token = streamClient.generateUserToken({
        user_id: user.id,
      });

      return jsonResponse(
        {
          apiKey: streamApiKey,
          token,
          userId: user.id,
        },
        200
      );
    } catch (error) {
      const safeErrorMessage = error instanceof Error ? error.message : 'Unknown token generation error';

      console.log('[stream-token] token generation failed', {
        message: safeErrorMessage,
      });

      return jsonResponse(
        {
          error: 'Token generation failed',
        },
        500
      );
    }
  } catch (error) {
    const safeErrorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.log('[stream-token] unexpected error', {
      message: safeErrorMessage,
    });

    return jsonResponse(
      {
        error: 'Function runtime error',
      },
      500
    );
  }
});
