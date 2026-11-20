import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "./env";

export { isSupabaseConfigured, env };

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = client;

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      "Supabase client is not initialized. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment configuration."
    );
  }
  return client;
}
