import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { StreamClient } from 'npm:@stream-io/node-sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase env vars');
    }

    if (!streamApiKey || !streamApiSecret) {
      throw new Error('Missing Stream env vars');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(
        JSON.stringify({
          error: userError?.message || 'Unauthorized',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const streamClient = new StreamClient(streamApiKey, streamApiSecret);
    const token = streamClient.generateUserToken({
      user_id: user.id,
    });

    return new Response(
      JSON.stringify({
        apiKey: streamApiKey,
        token,
        userId: user.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.log('stream-token error:', error);

    return new Response(
      JSON.stringify({
        error: (error as Error)?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
