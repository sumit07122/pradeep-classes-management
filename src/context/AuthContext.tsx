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
      if (saved && ["owner", "admin", "teacher", "student"].includes(saved)) {
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

  // Fail-closed profile loader
  const loadUserProfile = useCallback(async (userId: string) => {
    const res = await authService.getUserProfile(userId);

    if (res.notProvisioned) {
      // FAIL CLOSED: No synthetic profile created
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(
        "Access denied: No institute profile has been provisioned for this authenticated user. Contact institute owner."
      );
      await authService.signOut();
      return;
    }

    if (res.error || !res.profile) {
      // Database/network error: FAIL CLOSED
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(
        `Database authorization error: ${res.error || "Unable to retrieve profile permissions."}`
      );
      return;
    }

    setUser(res.profile);
    setRole(res.profile.role);
    setIsAuthenticated(true);
    setAuthError(null);
  }, []);

  // Initialize auth session ONCE on mount - completely independent of dev role state
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      if (!isSupabaseConfigured) {
        // Local preview fallback without Supabase
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
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError("Failed to initialize authentication session.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    // Attach auth state change listener with safe cleanup
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserProfile]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      setAuthError("Database authentication service is not configured.");
      return { success: false, error: "Database authentication service is not configured." };
    }

    const res = await authService.signIn(email, password);
    setIsLoading(false);

    if (res.error || !res.user) {
      setAuthError(res.error || "Authentication failed.");
      return { success: false, error: res.error || "Authentication failed." };
    }

    setUser(res.user);
    setRole(res.user.role);
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
    // STRICT SECURITY GUARD: Only allowable in development mode
    if (!env.isDev || !env.enableDevRoleSwitch) {
      console.warn("Dev role switching is strictly forbidden in production builds.");
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
