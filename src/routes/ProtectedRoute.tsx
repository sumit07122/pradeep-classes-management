import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { isSupabaseConfigured, env } from "../lib/env";
import type { UserRole } from "../types";

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  // If Supabase is unconfigured in production, route immediately to configuration error
  if (!isSupabaseConfigured && env.isProd) {
    return <Navigate to="/config-error" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb]">
        <LoadingSpinner label="Verifying session and security clearance..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role authorization check: redirect directly to login with context
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location,
          unauthorized: true,
          requiredRoles: allowedRoles,
          currentRole: role,
        }}
        replace
      />
    );
  }

  return children ? <>{children}</> : null;
};
