import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import type { AuthContextType } from "../context/AuthContext";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { Login } from "../pages/Login";
import { Unauthorized } from "../pages/Unauthorized";
import type { UserRole } from "../types";

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

function createMockAuthContext(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: {
      id: "test-user-id",
      email: "student@pradeepclasses.in",
      role: "student",
      full_name: "Test Student",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    role: "student",
    isAuthenticated: true,
    isLoading: false,
    isDemoMode: false,
    authError: null,
    signIn: async () => ({ success: true }),
    signOut: async () => {},
    setDevRole: () => {},
    clearError: () => {},
    ...overrides,
  };
}

export function getAuthorizedWorkspacePath(role: string): string {
  if (role === "student") {
    return "/portal";
  }
  if (role === "super_admin") {
    return "/platform";
  }
  return "/dashboard";
}

export function formatUnauthorizedMessage(currentRole: string, requiredRoles: string[]): string {
  const rolesText = requiredRoles && requiredRoles.length > 0 ? requiredRoles.join(" or ") : "higher";
  return `Access Restricted: You are currently signed in as '${currentRole}'. That section requires ${rolesText} clearance.`;
}

export async function runAuthRedirectTests() {
  console.log("=== Running authRedirect Unit Tests ===");

  // --------------------------------------------------------------------------
  // Test 1: ProtectedRoute role mismatch redirects to /login with unauthorized state
  // --------------------------------------------------------------------------
  {
    let capturedElement: any = null;

    function TestHarness() {
      capturedElement = ProtectedRoute({
        children: React.createElement("div", null, "Secret Admin Section"),
        allowedRoles: ["admin", "owner"] as UserRole[],
      });
      return React.createElement("div", null, "rendered");
    }

    const mockAuth = createMockAuthContext({
      isAuthenticated: true,
      role: "student" as UserRole,
    });

    renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/admin/settings"] },
        React.createElement(
          AuthContext.Provider,
          { value: mockAuth },
          React.createElement(TestHarness)
        )
      )
    );

    assertTrue(capturedElement !== null, "ProtectedRoute should return a Navigate element");
    assertEqual(capturedElement.props.to, "/login", "Unauthorized access must redirect to /login");
    assertEqual(capturedElement.props.replace, true, "Redirect must use replace: true");
    assertEqual(capturedElement.props.state?.unauthorized, true, "state.unauthorized must be true");
    assertEqual(
      capturedElement.props.state?.requiredRoles,
      ["admin", "owner"],
      "state.requiredRoles must contain required roles"
    );
    assertEqual(capturedElement.props.state?.currentRole, "student", "state.currentRole must match user role");
    assertEqual(
      capturedElement.props.state?.from?.pathname,
      "/admin/settings",
      "state.from must preserve the attempted location"
    );
    console.log("✓ ProtectedRoute redirects unauthorized authenticated user to /login with unauthorized state");
  }

  // --------------------------------------------------------------------------
  // Test 2: ProtectedRoute redirects unauthenticated user to /login without unauthorized flag
  // --------------------------------------------------------------------------
  {
    let capturedElement: any = null;

    function TestHarness() {
      capturedElement = ProtectedRoute({
        children: React.createElement("div", null, "Members Area"),
        allowedRoles: ["student"] as UserRole[],
      });
      return React.createElement("div", null, "rendered");
    }

    const mockAuth = createMockAuthContext({
      isAuthenticated: false,
      user: null,
      role: "owner" as UserRole,
    });

    renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/portal"] },
        React.createElement(
          AuthContext.Provider,
          { value: mockAuth },
          React.createElement(TestHarness)
        )
      )
    );

    assertEqual(capturedElement.props.to, "/login", "Unauthenticated must redirect to /login");
    assertEqual(capturedElement.props.replace, true, "Redirect must use replace: true");
    assertEqual(capturedElement.props.state?.unauthorized, undefined, "state.unauthorized should not be set for unauthenticated");
    assertEqual(capturedElement.props.state?.from?.pathname, "/portal", "state.from must preserve attempted path");
    console.log("✓ ProtectedRoute redirects unauthenticated user to /login with from state");
  }

  // --------------------------------------------------------------------------
  // Test 3: ProtectedRoute allows authorized users through
  // --------------------------------------------------------------------------
  {
    let capturedElement: any = null;

    function TestHarness() {
      capturedElement = ProtectedRoute({
        children: React.createElement("div", { id: "allowed" }, "Welcome Admin"),
        allowedRoles: ["admin", "owner"] as UserRole[],
      });
      return React.createElement("div", null, "rendered");
    }

    const mockAuth = createMockAuthContext({
      isAuthenticated: true,
      role: "admin" as UserRole,
    });

    renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/dashboard"] },
        React.createElement(
          AuthContext.Provider,
          { value: mockAuth },
          React.createElement(TestHarness)
        )
      )
    );

    assertTrue(capturedElement !== null, "ProtectedRoute should return children element");
    assertTrue(capturedElement.props.to === undefined, "Authorized user should not be redirected");
    console.log("✓ ProtectedRoute permits access for authorized user role");
  }

  // --------------------------------------------------------------------------
  // Test 4: Workspace return path routing logic
  // --------------------------------------------------------------------------
  {
    assertEqual(getAuthorizedWorkspacePath("student"), "/portal", "Student must return to /portal");
    assertEqual(getAuthorizedWorkspacePath("super_admin"), "/platform", "Super admin must return to /platform");
    assertEqual(getAuthorizedWorkspacePath("owner"), "/dashboard", "Owner must return to /dashboard");
    assertEqual(getAuthorizedWorkspacePath("admin"), "/dashboard", "Admin must return to /dashboard");
    assertEqual(getAuthorizedWorkspacePath("teacher"), "/dashboard", "Teacher must return to /dashboard");
    console.log("✓ Workspace return routing paths correctly map roles to portals");
  }

  // --------------------------------------------------------------------------
  // Test 5: Unauthorized alert banner message formatting
  // --------------------------------------------------------------------------
  {
    const msg = formatUnauthorizedMessage("student", ["admin", "owner"]);
    assertEqual(
      msg,
      "Access Restricted: You are currently signed in as 'student'. That section requires admin or owner clearance.",
      "Message must match exact required template"
    );

    const singleRoleMsg = formatUnauthorizedMessage("teacher", ["super_admin"]);
    assertEqual(
      singleRoleMsg,
      "Access Restricted: You are currently signed in as 'teacher'. That section requires super_admin clearance.",
      "Message must work with single required role"
    );
    console.log("✓ Unauthorized alert message matches exact format");
  }

  // --------------------------------------------------------------------------
  // Test 6: Login page renders alert banner & return button when unauthorized is true
  // --------------------------------------------------------------------------
  {
    const mockAuth = createMockAuthContext({
      isAuthenticated: true,
      role: "student" as UserRole,
    });

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [
            {
              pathname: "/login",
              state: {
                unauthorized: true,
                currentRole: "student",
                requiredRoles: ["admin", "owner"],
              },
            },
          ],
        },
        React.createElement(
          AuthContext.Provider,
          { value: mockAuth },
          React.createElement(Login)
        )
      )
    );

    assertTrue(
      html.includes("Access Restricted: You are currently signed in as &#x27;student&#x27;. That section requires admin or owner clearance.") ||
      html.includes("Access Restricted: You are currently signed in as 'student'. That section requires admin or owner clearance."),
      "Login must render the exact unauthorized alert notice"
    );
    assertTrue(
      html.includes("← Return to Authorized Workspace"),
      "Login must render '← Return to Authorized Workspace' button"
    );
    assertTrue(
      html.includes('type="email"') && html.includes('type="password"'),
      "Login fields must remain active below for switching accounts"
    );
    console.log("✓ Login page renders unauthorized banner, return button, and active credentials form");
  }

  // --------------------------------------------------------------------------
  // Test 7: Login page does NOT render unauthorized banner on normal visit
  // --------------------------------------------------------------------------
  {
    const mockAuth = createMockAuthContext({
      isAuthenticated: false,
    });

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/login"] },
        React.createElement(
          AuthContext.Provider,
          { value: mockAuth },
          React.createElement(Login)
        )
      )
    );

    assertTrue(
      !html.includes("Access Restricted: You are currently signed in as"),
      "Normal login page must not display access restricted banner"
    );
    assertTrue(
      !html.includes("← Return to Authorized Workspace"),
      "Normal login page must not display return button"
    );
    assertTrue(
      html.includes('type="email"') && html.includes('type="password"'),
      "Normal login page must display credentials input fields"
    );
    console.log("✓ Login page behaves normally when no unauthorized redirect state is present");
  }

  // --------------------------------------------------------------------------
  // Test 8: Unauthorized page fallback behavior
  // --------------------------------------------------------------------------
  {
    // Authenticated student
    const studentAuth = createMockAuthContext({
      isAuthenticated: true,
      role: "student" as UserRole,
    });

    const studentHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/unauthorized"] },
        React.createElement(
          AuthContext.Provider,
          { value: studentAuth },
          React.createElement(Unauthorized)
        )
      )
    );

    assertTrue(studentHtml.includes("Return to Student Portal"), "Student sees Return to Student Portal");
    assertTrue(studentHtml.includes("Student Authorized Links:"), "Student sees authorized shortcuts");

    // Authenticated staff
    const staffAuth = createMockAuthContext({
      isAuthenticated: true,
      role: "teacher" as UserRole,
    });

    const staffHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/unauthorized"] },
        React.createElement(
          AuthContext.Provider,
          { value: staffAuth },
          React.createElement(Unauthorized)
        )
      )
    );

    assertTrue(staffHtml.includes("Return to Authorized Workspace"), "Staff sees Return to Authorized Workspace");
    assertTrue(!staffHtml.includes("Student Authorized Links:"), "Staff does not see student links");

    // Unauthenticated user hitting /unauthorized directly
    const unauthAuth = createMockAuthContext({
      isAuthenticated: false,
    });

    const unauthHtml = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/unauthorized"] },
        React.createElement(
          AuthContext.Provider,
          { value: unauthAuth },
          React.createElement(Unauthorized)
        )
      )
    );

    assertTrue(unauthHtml.includes("Return to Sign In"), "Unauthenticated user sees Return to Sign In");
    assertTrue(unauthHtml.includes("Sign In to Account"), "Unauthenticated user sees Sign In button");
    console.log("✓ Unauthorized fallback page provides role-appropriate return options for all states");
  }

  console.log("=== All authRedirect Unit Tests Passed Successfully ===");
}

runAuthRedirectTests().catch((err) => {
  console.error("Test suite failed:", err);
  if (proc && proc.exit) {
    proc.exit(1);
  }
});
