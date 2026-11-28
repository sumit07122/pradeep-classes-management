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
import { FinanceDashboard } from "../pages/FinanceDashboard";
import { Expenses } from "../pages/Expenses";
import { TeacherPayroll } from "../pages/TeacherPayroll";
import { ClassDiary } from "../pages/ClassDiary";
import { PlatformAdmin } from "../pages/PlatformAdmin";
import { DataMigration } from "../pages/DataMigration";

export const AppRoutes: React.FC = () => {
  const { role, user, signOut, setDevRole } = useAuth();

  const wrapWithShell = (title: string, component: React.ReactNode) => (
    <AppShell
      pageTitle={title}
      userRole={role}
      userName={user?.full_name || "Institute User"}
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

      {/* Super Admin Platform Console */}
      <Route
        path="/platform"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            {wrapWithShell("Platform Master Console", <PlatformAdmin />)}
          </ProtectedRoute>
        }
      />

      {/* Overview / Dashboard */}
      <Route
        path="/dashboard"
        element={
          role === "student" ? (
            <Navigate to="/portal" replace />
          ) : (
            <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "accountant", "teacher"]}>
              {wrapWithShell("Overview", <Dashboard />)}
            </ProtectedRoute>
          )
        }
      />

      {/* Students Directory */}
      <Route
        path="/students"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin"]}>
            {wrapWithShell("Students", <Students />)}
          </ProtectedRoute>
        }
      />

      {/* Teachers Directory */}
      <Route
        path="/teachers"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin"]}>
            {wrapWithShell("Teachers", <Teachers />)}
          </ProtectedRoute>
        }
      />

      {/* Batches Management */}
      <Route
        path="/batches"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher"]}>
            {wrapWithShell("Batches", <Batches />)}
          </ProtectedRoute>
        }
      />

      {/* Attendance Roll Call */}
      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher"]}>
            {wrapWithShell("Attendance", <Attendance />)}
          </ProtectedRoute>
        }
      />

      {/* Fee Records & Payment Ledger */}
      <Route
        path="/fees"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "accountant"]}>
            {wrapWithShell("Fee Management", <Fees />)}
          </ProtectedRoute>
        }
      />

      {/* Finance & Business Analytics */}
      <Route
        path="/finance"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "accountant"]}>
            {wrapWithShell("Finance & Analytics", <FinanceDashboard />)}
          </ProtectedRoute>
        }
      />

      {/* Expense Ledger */}
      <Route
        path="/finance/expenses"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "accountant"]}>
            {wrapWithShell("Expense Ledger", <Expenses />)}
          </ProtectedRoute>
        }
      />

      {/* Teacher Payroll */}
      <Route
        path="/finance/payroll"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "accountant"]}>
            {wrapWithShell("Teacher Payroll", <TeacherPayroll />)}
          </ProtectedRoute>
        }
      />

      {/* Academics & Exams */}
      <Route
        path="/academics"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher"]}>
            {wrapWithShell("Exams & Marks", <Academics />)}
          </ProtectedRoute>
        }
      />

      {/* Class Diary & Lesson Tracking (Phase 2) */}
      <Route
        path="/diary"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Class Diary & Syllabus", <ClassDiary />)}
          </ProtectedRoute>
        }
      />

      {/* Timetable */}
      <Route
        path="/timetable"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Timetable", <Timetable />)}
          </ProtectedRoute>
        }
      />

      {/* Study Materials & Homework */}
      <Route
        path="/materials"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Study Materials", <HomeworkMaterials />)}
          </ProtectedRoute>
        }
      />

      {/* Announcements & WhatsApp Queue */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Announcements", <Announcements />)}
          </ProtectedRoute>
        }
      />

      {/* Reports & Data Export */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "accountant"]}>
            {wrapWithShell("Reports & Export", <Reports />)}
          </ProtectedRoute>
        }
      />

      {/* Data Migration Center */}
      <Route
        path="/migration"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin"]}>
            {wrapWithShell("Data Migration Center", <DataMigration />)}
          </ProtectedRoute>
        }
      />

      {/* Settings & Profile (Accessible by all roles) */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "owner", "admin", "teacher", "student"]}>
            {wrapWithShell("Settings & Profile", <Settings />)}
          </ProtectedRoute>
        }
      />

      {/* Student Academic Portal */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={["student", "super_admin", "owner", "admin"]}>
            {wrapWithShell("Student Portal", <Portal />)}
          </ProtectedRoute>
        }
      />

      {/* Root redirect depending on active role */}
      <Route
        path="/"
        element={
          <Navigate
            to={
              role === "student"
                ? "/portal"
                : role === "super_admin"
                ? "/platform"
                : "/dashboard"
            }
            replace
          />
        }
      />

      {/* Wildcard fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
