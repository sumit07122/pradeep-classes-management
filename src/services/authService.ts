import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { UserProfile, UserRole } from "../types";

export interface AuthResponse {
  user: UserProfile | null;
  error?: string;
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

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, phone, created_at")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.warn("Could not fetch user profile from Supabase:", error?.message);
        return null;
      }

      return {
        id: data.id,
        full_name: data.full_name,
        role: data.role as UserRole,
        phone: data.phone || undefined,
        created_at: data.created_at,
      };
    } catch (err) {
      console.error("Error retrieving profile:", err);
      return null;
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

    const profile = await this.getUserProfile(data.user.id);
    if (!profile) {
      return {
        user: {
          id: data.user.id,
          full_name: data.user.email?.split("@")[0] || "Institute User",
          email: data.user.email,
          role: "student", // default safe fallback role
        },
      };
    }

    return {
      user: {
        ...profile,
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        callback(session?.user?.id || null);
      }
    );

    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  },
};
