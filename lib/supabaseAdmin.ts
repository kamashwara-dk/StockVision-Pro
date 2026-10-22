/**
 * lib/supabaseAdmin.ts — Server-only Supabase admin client.
 *
 * Uses the service role key. NEVER import this in client components or
 * expose it in any response body. The browser never sees any Supabase key.
 *
 * Used by the Next.js API layer to read forecast_runs rows directly
 * (as a fallback if the model service is unavailable, and for the
 * integration test).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as server-side environment variables."
    );
  }

  _client = createClient(url, key, {
    auth: {
      // Disable the Supabase auth session management; we only use the DB.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}
