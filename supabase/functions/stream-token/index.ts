import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { StreamClient } from "https://esm.sh/@stream-io/node-sdk@0.4.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS preflight requests from the mobile app
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Safely extract environment variables securely injected by Supabase Secrets
    const STREAM_API_KEY = Deno.env.get('STREAM_API_KEY');
    const STREAM_API_SECRET = Deno.env.get('STREAM_API_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!STREAM_API_KEY || !STREAM_API_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing required environment variables.");
    }

    // 3. Extract the Supabase JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("No authorization header provided.");
    }
    const token = authHeader.replace('Bearer ', '');

    // 4. Verify user securely via Supabase Auth
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid or expired user token. You must be logged in.");
    }

    const userId = user.id;

    // 5. Generate a secure Stream Token for the verified user
    const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    
    // Tokens are valid for exactly 1 hour for optimal security
    const exp = Math.round(new Date().getTime() / 1000) + 60 * 60;
    const streamToken = streamClient.generateUserToken({ user_id: userId, exp });

    // 6. Return the required payload back to the mobile app
    const responsePayload = {
      token: streamToken,
      apiKey: STREAM_API_KEY,
      userId: userId
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
