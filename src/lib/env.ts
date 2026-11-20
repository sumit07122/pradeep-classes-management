export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || "").trim(),
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim(),
  isDev: Boolean(import.meta.env.DEV),
  isProd: Boolean(import.meta.env.PROD),
  mode: import.meta.env.MODE || "development",
  // Dev role switching is STRICTLY prohibited in production builds
  enableDevRoleSwitch:
    Boolean(import.meta.env.DEV) &&
    import.meta.env.VITE_ENABLE_DEV_ROLE_SWITCH !== "false",
};

export const isSupabaseConfigured: boolean = Boolean(
  env.supabaseUrl &&
    env.supabaseAnonKey &&
    !env.supabaseUrl.includes("YOUR_PROJECT") &&
    !env.supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY") &&
    env.supabaseUrl.startsWith("http")
);
