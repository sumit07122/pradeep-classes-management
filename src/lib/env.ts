const DEFAULT_SUPABASE_URL = "https://gajibrwnccddnrbnhwmh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamlicnduY2NkZG5yYm5od21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNzQzMjUsImV4cCI6MjExMDc1MDMyNX0.bRIRMF6UZB6VbYaa9yZNO74-0RXMW_4vWnfLCotrrrw";

const meta = (typeof import.meta !== "undefined" ? (import.meta as any).env : undefined) || {};

export const env = {
  supabaseUrl: ((meta.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL).trim(),
  supabaseAnonKey: ((meta.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY).trim(),
  appUrl: (
    (meta.VITE_APP_URL as string) ||
    (meta.PROD ? "https://app.pradeepclasses.in" : "http://localhost:5173")
  ).trim(),
  instituteWebsite: "https://pradeepclasses.in",
  isDev: Boolean(meta.DEV),
  isProd: Boolean(meta.PROD),
  mode: (meta.MODE as string) || "development",
  // Dev role switching is STRICTLY prohibited in production builds
  enableDevRoleSwitch:
    Boolean(meta.DEV) &&
    meta.VITE_ENABLE_DEV_ROLE_SWITCH !== "false",
};

export const isSupabaseConfigured: boolean = Boolean(
  env.supabaseUrl &&
    env.supabaseAnonKey &&
    !env.supabaseUrl.includes("YOUR_PROJECT") &&
    !env.supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY") &&
    env.supabaseUrl.startsWith("http")
);
