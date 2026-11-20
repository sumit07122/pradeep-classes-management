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
import { Timetable } from "../pages/Timetable";
import { HomeworkMaterials } from "../pages/HomeworkMaterials";
import { Announcements } from "../pages/Announcements";
import { Reports } from "../pages/Reports";
import { Settings } from "../pages/Settings";
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

      {/* Overview / Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Overview", <Dashboard />)}
          </ProtectedRoute>
        }
      />

      {/* Students Directory */}
      <Route
        path="/students"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Students", <Students />)}
          </ProtectedRoute>
        }
      />

      {/* Teachers Directory */}
      <Route
        path="/teachers"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Teachers", <Teachers />)}
          </ProtectedRoute>
        }
      />

      {/* Batches Management */}
      <Route
        path="/batches"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Batches", <Batches />)}
          </ProtectedRoute>
        }
      />

      {/* Attendance Roll Call */}
      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Attendance", <Attendance />)}
          </ProtectedRoute>
        }
      />

      {/* Fee Records & Payment Ledger */}
      <Route
        path="/fees"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Fee Management", <Fees />)}
          </ProtectedRoute>
        }
      />

      {/* Academics & Exams */}
      <Route
        path="/academics"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher"]}>
            {wrapWithShell("Exams & Marks", <Academics />)}
          </ProtectedRoute>
        }
      />

      {/* Timetable */}
      <Route
        path="/timetable"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Timetable", <Timetable />)}
          </ProtectedRoute>
        }
      />

      {/* Study Materials & Homework */}
      <Route
        path="/materials"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Study Materials", <HomeworkMaterials />)}
          </ProtectedRoute>
        }
      />

      {/* Announcements & WhatsApp Queue */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Announcements", <Announcements />)}
          </ProtectedRoute>
        }
      />

      {/* Reports & Data Export */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Reports & Export", <Reports />)}
          </ProtectedRoute>
        }
      />

      {/* Institute Settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            {wrapWithShell("Settings", <Settings />)}
          </ProtectedRoute>
        }
      />

      {/* Student Academic Portal */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={["student", "owner", "admin"]}>
            {wrapWithShell("Student Portal", <Portal />)}
          </ProtectedRoute>
        }
      />

      {/* Root redirect depending on active role */}
      <Route
        path="/"
        element={
          role === "student" ? (
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
