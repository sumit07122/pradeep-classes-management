import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import type { AuthContextType } from "../context/AuthContext";
import type { InstituteUser } from "../types/user";
import type { UserRole } from "../types/auth";
import {
  generateSecurePassword,
  formatWhatsAppUrl,
  buildCredentialsMessage,
  filterUsers,
  UserManagementTab,
} from "../components/users/UserManagementTab";
import { Settings } from "../pages/Settings";

const proc = (globalThis as any).process;

function assertEqual<T>(actual: T, expected: T, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Assertion failed.\nExpected: ${expectedStr}\nActual:   ${actualStr}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed: expected true, got false");
  }
}

function createMockAuthContext(role: UserRole): AuthContextType {
  return {
    user: {
      id: "test-admin-id",
      email: "admin@pradeepclasses.in",
      role,
      full_name: "Test Administrator",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    role,
    isAuthenticated: true,
    isLoading: false,
    isDemoMode: false,
    authError: null,
    signIn: async () => ({ success: true }),
    signOut: async () => {},
    setDevRole: () => {},
    clearError: () => {},
  };
}

export async function runUserManagementUiTests() {
  console.log("=== Running User Management UI & Hub Tests ===");

  // --------------------------------------------------------------------------
  // Test 1: generateSecurePassword
  // --------------------------------------------------------------------------
  {
    const pwd1 = generateSecurePassword();
    assertTrue(pwd1.length >= 10, "Default password should have at least 10 characters");
    assertTrue(/[a-z]/.test(pwd1), "Password should have lowercase letters");
    assertTrue(/[A-Z]/.test(pwd1), "Password should have uppercase letters");
    assertTrue(/[0-9]/.test(pwd1), "Password should have numbers");
    assertTrue(/[!@#$%&*]/.test(pwd1), "Password should have special characters");

    const pwdCustom = generateSecurePassword(14);
    assertEqual(pwdCustom.length, 14, "Password should respect custom length");
    console.log("✓ generateSecurePassword produces strong mixed-character passwords");
  }

  // --------------------------------------------------------------------------
  // Test 2: formatWhatsAppUrl & buildCredentialsMessage
  // --------------------------------------------------------------------------
  {
    const phone10 = "9876543210";
    const phoneWithCountry = "919876543210";
    const phoneFormatted = "+91 98765-43210";

    const url1 = formatWhatsAppUrl(phone10, "Hello Test");
    assertTrue(url1.includes("https://wa.me/919876543210?text=Hello%20Test"), "10-digit number should have 91 prepended");

    const url2 = formatWhatsAppUrl(phoneWithCountry, "Hello Test");
    assertTrue(url2.includes("https://wa.me/919876543210?text=Hello%20Test"), "12-digit number should retain country code");

    const url3 = formatWhatsAppUrl(phoneFormatted, "Hello Test");
    assertTrue(url3.includes("https://wa.me/919876543210?text=Hello%20Test"), "Formatted number should be cleaned to digits");

    const msgNew = buildCredentialsMessage({
      name: "Aman Gupta",
      username: "aman.g@pradeepclasses.in",
      password: "SecretPassword123!",
      portalUrl: "https://pradeepclasses.in/login",
      isReset: false,
    });
    assertTrue(msgNew.includes("Aman Gupta"), "Message should include user name");
    assertTrue(msgNew.includes("aman.g@pradeepclasses.in"), "Message should include username");
    assertTrue(msgNew.includes("SecretPassword123!"), "Message should include password");
    assertTrue(msgNew.includes("https://pradeepclasses.in/login"), "Message should include portal link");

    const msgReset = buildCredentialsMessage({
      name: "Aman Gupta",
      username: "aman.g@pradeepclasses.in",
      password: "NewPassword456!",
      portalUrl: "https://pradeepclasses.in/login",
      isReset: true,
    });
    assertTrue(msgReset.includes("Reset"), "Message should indicate password reset");
    assertTrue(msgReset.includes("NewPassword456!"), "Message should include new password");

    console.log("✓ formatWhatsAppUrl and buildCredentialsMessage correctly format links and text");
  }

  // --------------------------------------------------------------------------
  // Test 3: filterUsers by Role and Search Query
  // --------------------------------------------------------------------------
  {
    const sampleUsers: InstituteUser[] = [
      {
        id: "u1",
        email: "student1@pradeepclasses.in",
        full_name: "Rohan Patil",
        role: "student",
        phone: "9820011111",
        is_active: true,
        linked_student_name: "Rohan Patil",
        linked_admission_no: "PC-2026-001",
      },
      {
        id: "u2",
        email: "teacher1@pradeepclasses.in",
        full_name: "Sunita Deshmukh",
        role: "teacher",
        phone: "9820022222",
        is_active: true,
        linked_teacher_name: "Sunita Deshmukh",
      },
      {
        id: "u3",
        email: "admin1@pradeepclasses.in",
        full_name: "Admin User",
        role: "admin",
        phone: "9820033333",
        is_active: false,
      },
      {
        id: "u4",
        email: "owner1@pradeepclasses.in",
        full_name: "Institute Owner",
        role: "owner",
        phone: "9820044444",
        is_active: true,
      },
    ];

    // Role filtering
    const all = filterUsers(sampleUsers, "all", "");
    assertEqual(all.length, 4, "Role 'all' should return 4 users");

    const teachers = filterUsers(sampleUsers, "teachers", "");
    assertEqual(teachers.length, 1, "Role 'teachers' should return 1 user");
    assertEqual(teachers[0].full_name, "Sunita Deshmukh");

    const students = filterUsers(sampleUsers, "students", "");
    assertEqual(students.length, 1, "Role 'students' should return 1 user");
    assertEqual(students[0].full_name, "Rohan Patil");

    const admins = filterUsers(sampleUsers, "admins", "");
    assertEqual(admins.length, 2, "Role 'admins' should include admin and owner");

    // Search query filtering
    const searchByName = filterUsers(sampleUsers, "all", "Rohan");
    assertEqual(searchByName.length, 1);
    assertEqual(searchByName[0].id, "u1");

    const searchByEmail = filterUsers(sampleUsers, "all", "teacher1@");
    assertEqual(searchByEmail.length, 1);
    assertEqual(searchByEmail[0].id, "u2");

    const searchByPhone = filterUsers(sampleUsers, "all", "9820033333");
    assertEqual(searchByPhone.length, 1);
    assertEqual(searchByPhone[0].id, "u3");

    const searchByAdmissionNo = filterUsers(sampleUsers, "all", "PC-2026-001");
    assertEqual(searchByAdmissionNo.length, 1);
    assertEqual(searchByAdmissionNo[0].id, "u1");

    console.log("✓ filterUsers filters users accurately by role pills and multi-field search");
  }

  // --------------------------------------------------------------------------
  // Test 4: UserManagementTab Static Markup & Components
  // --------------------------------------------------------------------------
  {
    const initialUsers: InstituteUser[] = [
      {
        id: "u-test-1",
        email: "student.test@pradeepclasses.in",
        full_name: "Test Student Row",
        role: "student",
        phone: "9998887771",
        is_active: true,
        linked_student_name: "Test Student Row",
        linked_admission_no: "PC-TEST-99",
      },
      {
        id: "u-test-2",
        email: "faculty.test@pradeepclasses.in",
        full_name: "Test Faculty Row",
        role: "teacher",
        phone: "9998887772",
        is_active: false,
        linked_teacher_name: "Test Faculty Row",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(UserManagementTab, { initialUsers })
      )
    );

    assertTrue(html.includes("User Accounts"), "Should display tab heading");
    assertTrue(html.includes("Create New User"), "Should display Create New User action button");
    assertTrue(html.includes("All"), "Should display All role filter pill");
    assertTrue(html.includes("Teachers"), "Should display Teachers role filter pill");
    assertTrue(html.includes("Students"), "Should display Students role filter pill");
    assertTrue(html.includes("Admins"), "Should display Admins role filter pill");
    assertTrue(html.includes("Test Student Row"), "Should display user name in table");
    assertTrue(html.includes("PC-TEST-99"), "Should display linked admission number");
    assertTrue(html.includes("faculty.test@pradeepclasses.in"), "Should display faculty email");
    assertTrue(html.includes("Reset Password"), "Should display Reset Password action button");

    console.log("✓ UserManagementTab renders full user management table, filters, and actions");
  }

  // --------------------------------------------------------------------------
  // Test 5: Settings Page Tab Integration
  // --------------------------------------------------------------------------
  {
    // Render Settings with Admin Role
    const adminHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: createMockAuthContext("admin") },
          React.createElement(Settings, { initialLoading: false })
        )
      )
    );
    assertTrue(
      adminHtml.includes("User Accounts &amp; Logins") || adminHtml.includes("User Accounts & Logins"),
      "Settings page should show 'User Accounts & Logins' tab for admin"
    );

    // Render Settings with Student Role
    const studentHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: createMockAuthContext("student") },
          React.createElement(Settings, { initialLoading: false })
        )
      )
    );
    assertTrue(
      !studentHtml.includes("User Accounts &amp; Logins") && !studentHtml.includes("User Accounts & Logins"),
      "Settings page should NOT show 'User Accounts & Logins' tab for student"
    );

    // Render Settings with Teacher Role
    const teacherHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: createMockAuthContext("teacher") },
          React.createElement(Settings, { initialLoading: false })
        )
      )
    );
    assertTrue(
      !teacherHtml.includes("User Accounts &amp; Logins") && !teacherHtml.includes("User Accounts & Logins"),
      "Settings page should NOT show 'User Accounts & Logins' tab for teacher"
    );

    // Render Settings with Super Admin Role
    const superAdminHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: createMockAuthContext("super_admin") },
          React.createElement(Settings, { initialLoading: false })
        )
      )
    );
    assertTrue(
      superAdminHtml.includes("User Accounts &amp; Logins") || superAdminHtml.includes("User Accounts & Logins"),
      "Settings page should show 'User Accounts & Logins' tab for super_admin"
    );

    // Render Settings with Owner Role
    const ownerHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: createMockAuthContext("owner") },
          React.createElement(Settings, { initialLoading: false })
        )
      )
    );
    assertTrue(
      ownerHtml.includes("User Accounts &amp; Logins") || ownerHtml.includes("User Accounts & Logins"),
      "Settings page should show 'User Accounts & Logins' tab for owner"
    );

    console.log("✓ Settings page grants 'User Accounts & Logins' tab only to management roles");
  }

  // --------------------------------------------------------------------------
  // Test 6: Empty State and Status Badges
  // --------------------------------------------------------------------------
  {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(UserManagementTab, { initialUsers: [] })
      )
    );
    assertTrue(emptyHtml.includes("No User Accounts Found"), "Should render empty state title when users array is empty");

    const singleUser: InstituteUser[] = [
      {
        id: "u-active",
        email: "active@pradeepclasses.in",
        full_name: "Active Student",
        role: "student",
        is_active: true,
      },
      {
        id: "u-inactive",
        email: "inactive@pradeepclasses.in",
        full_name: "Inactive Teacher",
        role: "teacher",
        is_active: false,
      },
    ];

    const statusHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(UserManagementTab, { initialUsers: singleUser })
      )
    );

    assertTrue(statusHtml.includes("Deactivate"), "Active user should have Deactivate action");
    assertTrue(statusHtml.includes("Activate"), "Inactive user should have Activate action");
    assertTrue(statusHtml.includes("Active"), "Active badge should render");
    assertTrue(statusHtml.includes("Inactive"), "Inactive badge should render");
    console.log("✓ UserManagementTab correctly reflects user status and corresponding toggle action buttons");
  }

  console.log("=== All User Management Hub Tests Passed Successfully ===");
}

// Run when executed directly
if (
  typeof proc !== "undefined" &&
  (import.meta.url === `file://${proc.argv?.[1]?.replace(/\\/g, "/")}` ||
    proc.argv?.[1]?.endsWith("userManagementUi.test.ts"))
) {
  runUserManagementUiTests().catch((err) => {
    console.error("Test execution failed:", err);
    if (proc?.exit) {
      proc.exit(1);
    }
  });
}
