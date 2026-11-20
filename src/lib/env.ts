const DEFAULT_SUPABASE_URL = "https://gajibrwnccddnrbnhwmh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamlicnduY2NkZG5yYm5od21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNzQzMjUsImV4cCI6MjExMDc1MDMyNX0.bRIRMF6UZB6VbYaa9yZNO74-0RXMW_4vWnfLCotrrrw";

export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim(),
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim(),
  appUrl: (
    import.meta.env.VITE_APP_URL ||
    (import.meta.env.PROD ? "https://app.pradeepclasses.in" : "http://localhost:5173")
  ).trim(),
  instituteWebsite: "https://pradeepclasses.in",
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
