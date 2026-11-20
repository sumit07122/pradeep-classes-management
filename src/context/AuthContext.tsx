import React, { createContext, useEffect, useState, useMemo, useCallback } from "react";
import { isSupabaseConfigured, env } from "../lib/env";
import { authService } from "../services/authService";
import type { UserProfile, UserRole } from "../types";

export interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setDevRole: (role: UserRole) => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_ROLE_STORAGE_KEY = "pradeep_dev_role";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>(() => {
    if (env.isDev) {
      const saved = localStorage.getItem(DEV_ROLE_STORAGE_KEY) as UserRole | null;
      if (saved && ["owner", "admin", "teacher", "student", "parent"].includes(saved)) {
        return saved;
      }
    }
    return "owner";
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isDemoMode = useMemo(() => {
    return !isSupabaseConfigured;
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    const profile = await authService.getUserProfile(userId);
    if (profile) {
      setUser(profile);
      setRole(profile.role);
      setIsAuthenticated(true);
    } else {
      // Fallback user if profile row isn't created yet
      setUser({
        id: userId,
        full_name: "Institute Member",
        role: "student",
      });
      setRole("student");
      setIsAuthenticated(true);
    }
  }, []);

  // Initialize auth session
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      if (!isSupabaseConfigured) {
        // In local development without Supabase, initialize mock user
        if (env.isDev) {
          const devUser: UserProfile = {
            id: "dev-mock-admin-id",
            full_name: "Pradeep Admin (Dev)",
            email: "admin@pradeepclasses.in",
            role: role,
          };
          setUser(devUser);
          setIsAuthenticated(true);
        } else {
          // Production without Supabase: Unauthenticated and blocked
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(
            "System configuration error: Supabase environment variables are missing in production."
          );
        }
        setIsLoading(false);
        return;
      }

      // Supabase is configured: check real session
      try {
        const session = await authService.getSession();
        if (session && isMounted) {
          await loadUserProfile(session.user.id);
        } else if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    // Listen for auth state changes
    const { unsubscribe } = authService.onAuthStateChange(async (userId) => {
      if (!isMounted) return;
      if (userId) {
        await loadUserProfile(userId);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadUserProfile, role]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    setIsLoading(true);

    if (isDemoMode) {
      // Demo/dev sign-in
      const mockProfile: UserProfile = {
        id: "demo-user-id",
        full_name: email.split("@")[0] || "Institute User",
        email,
        role: role,
      };
      setUser(mockProfile);
      setIsAuthenticated(true);
      setIsLoading(false);
      return { success: true };
    }

    const { user: authedUser, error } = await authService.signIn(email, password);
    setIsLoading(false);

    if (error || !authedUser) {
      setAuthError(error || "Invalid login credentials.");
      return { success: false, error: error || "Invalid login credentials." };
    }

    setUser(authedUser);
    setRole(authedUser.role);
    setIsAuthenticated(true);
    return { success: true };
  };

  const signOut = async () => {
    setIsLoading(true);
    await authService.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  const setDevRole = (newRole: UserRole) => {
    // STRICT GUARD: Only allowable in development
    if (!env.isDev || !env.enableDevRoleSwitch) {
      console.warn("Dev role switching is forbidden in production.");
      return;
    }
    setRole(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
    localStorage.setItem(DEV_ROLE_STORAGE_KEY, newRole);
  };

  const clearError = () => setAuthError(null);

  const value = useMemo(
    () => ({
      user,
      role,
      isAuthenticated,
      isLoading,
      isDemoMode,
      authError,
      signIn,
      signOut,
      setDevRole,
      clearError,
    }),
    [user, role, isAuthenticated, isLoading, isDemoMode, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
