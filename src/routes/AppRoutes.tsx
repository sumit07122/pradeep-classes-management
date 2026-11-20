import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { Login } from "../pages/Login";
import { Unauthorized } from "../pages/Unauthorized";
import { ConfigError } from "../pages/ConfigError";

// Pages
import { Dashboard } from "../pages/Dashboard";
import { Students } from "../pages/Students";
import { Teachers } from "../pages/Teachers";
import { Batches } from "../pages/Batches";
import { Attendance } from "../pages/Attendance";
import { Fees } from "../pages/Fees";
import { Academics } from "../pages/Academics";
import { Portal } from "../pages/Portal";

export const AppRoutes: React.FC = () => {
  const { role, user, signOut, setDevRole, isDemoMode } = useAuth();

  const wrapWithShell = (title: string, component: React.ReactNode) => (
    <AppShell
      pageTitle={title}
      userRole={role}
      userName={user?.full_name || "Institute User"}
      isDemoMode={isDemoMode}
      onSignOut={signOut}
      onDevRoleChange={setDevRole}
    >
      {component}
    </AppShell>
  );

  return (
    <Routes>
      {/* Public and Utility routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/config-error" element={<ConfigError />} />

      {/* Staff & Admin Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Overview", <Dashboard />)}
          </ProtectedRoute>
        }
      />

      <Route
        path="/students"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Students", <Students />)}
          </ProtectedRoute>
        }
      />

      <Route
        path="/teachers"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Teachers", <Teachers />)}
          </ProtectedRoute>
        }
      />

      <Route
        path="/batches"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Batches", <Batches />)}
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Attendance", <Attendance />)}
          </ProtectedRoute>
        }
      />

      <Route
        path="/fees"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Fees", <Fees />)}
          </ProtectedRoute>
        }
      />

      <Route
        path="/academics"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Academics", <Academics />)}
          </ProtectedRoute>
        }
      />

      {/* Student & Parent Portal */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={["student", "parent", "owner", "admin"]}>
            {wrapWithShell("Student Portal", <Portal />)}
          </ProtectedRoute>
        }
      />

      {/* Root redirect depending on active role */}
      <Route
        path="/"
        element={
          role === "student" || role === "parent" ? (
            <Navigate to="/portal" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      {/* Wildcard fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
