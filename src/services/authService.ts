import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { UserProfile, UserRole } from "../types";

export interface ProfileResult {
  profile: UserProfile | null;
  error?: string;
  notProvisioned?: boolean;
}

export interface AuthResponse {
  user: UserProfile | null;
  error?: string;
  notProvisioned?: boolean;
}

export const authService = {
  async getSession() {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
  },

  async getUserProfile(userId: string): Promise<ProfileResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { profile: null, notProvisioned: true };
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, phone, created_at")
        .eq("id", userId)
        .single();

      if (error) {
        // PGRST116 indicates row not found in PostgREST
        if (error.code === "PGRST116" || error.message?.includes("zero rows")) {
          return { profile: null, notProvisioned: true };
        }
        return { profile: null, error: error.message };
      }

      if (!data) {
        return { profile: null, notProvisioned: true };
      }

      return {
        profile: {
          id: data.id,
          full_name: data.full_name,
          role: data.role as UserRole,
          phone: data.phone || undefined,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { profile: null, error: err?.message || "Network error loading user profile." };
    }
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        user: null,
        error: "Database connection not configured. Check environment variables.",
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return {
        user: null,
        error: error?.message || "Failed to sign in. Please verify your credentials.",
      };
    }

    // Explicitly load profile and FAIL CLOSED if unprovisioned
    const profileRes = await this.getUserProfile(data.user.id);

    if (profileRes.notProvisioned) {
      // Invalidate session immediately to prevent unprovisioned access
      await supabase.auth.signOut();
      return {
        user: null,
        notProvisioned: true,
        error:
          "Account verified, but no institute profile has been provisioned for your user ID. Please contact your institute administrator.",
      };
    }

    if (profileRes.error || !profileRes.profile) {
      await supabase.auth.signOut();
      return {
        user: null,
        error: `Database authorization error: ${profileRes.error || "Unable to retrieve profile permissions."}`,
      };
    }

    return {
      user: {
        ...profileRes.profile,
        email: data.user.email,
      },
    };
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
  },

  onAuthStateChange(callback: (userId: string | null) => void) {
    if (!isSupabaseConfigured || !supabase) {
      return { unsubscribe: () => {} };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run callback asynchronously to avoid session-lock issues in Supabase JS
      setTimeout(() => {
        callback(session?.user?.id || null);
      }, 0);
    });

    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  },
};
