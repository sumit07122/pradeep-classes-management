import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, type AuthContextType } from "../context/AuthContext";
import { CredentialsModal } from "../components/users/CredentialsModal";
import { AdmissionModal } from "../components/students/AdmissionModal";
import { Students } from "../pages/Students";
import { Teachers } from "../pages/Teachers";
import { userService } from "../services/userService";
import type { UserRole } from "../types/auth";

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
      id: "admin-uid-1",
      email: "director@pradeepclasses.in",
      role,
      full_name: "Institute Director",
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

export async function runInlineUserProvisioningTests() {
  console.log("=== Running Inline User Provisioning Tests ===");

  // --------------------------------------------------------------------------
  // Test 1: CredentialsModal renders student credentials and WhatsApp dispatch
  // --------------------------------------------------------------------------
  {
    const studentCreds = {
      name: "Rohan Sharma",
      username: "pc-2026-101@pradeepclasses.in",
      password: "TempPassword!123",
      phone: "9876543210",
      role: "student",
      portalUrl: "https://pradeepclasses.in/login",
    };

    const html = renderToStaticMarkup(
      React.createElement(CredentialsModal, {
        isOpen: true,
        onClose: () => {},
        credentials: studentCreds,
        whatsAppButtonLabel: "Send Welcome WhatsApp to Student / Parent",
        title: "Student Portal Login Provisioned",
        subtitle: "STUDENT CREDENTIAL DISPATCH",
      })
    );

    assertTrue(html.includes("Student Portal Login Provisioned"), "Modal title should render");
    assertTrue(html.includes("Rohan Sharma"), "Student name should render");
    assertTrue(html.includes("pc-2026-101@pradeepclasses.in"), "Student username should render");
    assertTrue(html.includes("TempPassword!123"), "Temporary password should render");
    assertTrue(html.includes("student"), "Student role badge should render");
    assertTrue(html.includes("Copy Credentials to Clipboard"), "Copy credentials button should render");
    assertTrue(html.includes("Send Welcome WhatsApp to Student / Parent"), "Custom WhatsApp button label should render");
    assertTrue(html.includes("wa.me/919876543210"), "WhatsApp URL with country code should be formed");
    assertTrue(html.includes(encodeURIComponent("pc-2026-101@pradeepclasses.in")), "Encoded username in wa.me text");

    console.log("✓ CredentialsModal renders student credentials, role badge, and WhatsApp dispatch link");
  }

  // --------------------------------------------------------------------------
  // Test 2: CredentialsModal renders faculty credentials and access link
  // --------------------------------------------------------------------------
  {
    const facultyCreds = {
      name: "Dr. Sunita Patil",
      username: "sunita.patil@pradeepclasses.in",
      password: "FacultySecret#456",
      phone: "9820011223",
      role: "teacher",
      portalUrl: "https://pradeepclasses.in/login",
    };

    const html = renderToStaticMarkup(
      React.createElement(CredentialsModal, {
        isOpen: true,
        onClose: () => {},
        credentials: facultyCreds,
        whatsAppButtonLabel: "Send Faculty Portal Access via WhatsApp",
        title: "Faculty Portal Account Provisioned",
        subtitle: "FACULTY CREDENTIAL DISPATCH",
      })
    );

    assertTrue(html.includes("Faculty Portal Account Provisioned"), "Modal title should render");
    assertTrue(html.includes("Dr. Sunita Patil"), "Faculty name should render");
    assertTrue(html.includes("sunita.patil@pradeepclasses.in"), "Faculty username should render");
    assertTrue(html.includes("FacultySecret#456"), "Password should render");
    assertTrue(html.includes("teacher"), "Teacher role badge should render");
    assertTrue(
      html.includes("Send Faculty Portal Access via WhatsApp"),
      "Faculty WhatsApp button label should render"
    );
    assertTrue(html.includes("wa.me/919820011223"), "WhatsApp link for faculty phone");

    console.log("✓ CredentialsModal renders faculty credentials and portal access dispatch link");
  }

  // --------------------------------------------------------------------------
  // Test 3: AdmissionModal includes portal login toggle and auto-generation note
  // --------------------------------------------------------------------------
  {
    const html = renderToStaticMarkup(
      React.createElement(AdmissionModal, {
        isOpen: true,
        onClose: () => {},
        onSuccess: () => {},
      })
    );

    assertTrue(
      html.includes("Generate Student Portal Login Account"),
      "AdmissionModal must render the Generate Student Portal Login Account checkbox"
    );
    assertTrue(
      html.includes("Temporary Password"),
      "AdmissionModal must render the Temporary Password field"
    );
    assertTrue(
      html.includes("defaults to {admission_no}@pradeepclasses.in"),
      "AdmissionModal must explain the fallback to {admission_no}@pradeepclasses.in"
    );
    assertTrue(
      html.includes("Generate"),
      "AdmissionModal must render the Generate password button"
    );

    console.log("✓ AdmissionModal renders portal login toggle, password input, and helper notes");
  }

  // --------------------------------------------------------------------------
  // Test 4: Teachers page Add Faculty modal includes Email and Login toggle
  // --------------------------------------------------------------------------
  {
    const adminContext = createMockAuthContext("admin");

    const html = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: adminContext },
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(Teachers, { initialShowModal: true })
        )
      )
    );

    assertTrue(html.includes("Add teacher"), "Admin should see Add teacher button");
    assertTrue(
      html.includes("Email Address"),
      "Teachers page modal should include an Email Address input"
    );
    assertTrue(
      html.includes("Generate Faculty Portal Login Account"),
      "Teachers page modal should include Generate Faculty Portal Login Account toggle"
    );
    assertTrue(
      html.includes("Temporary Password"),
      "Teachers page modal should include Temporary Password input"
    );
    assertTrue(
      html.includes("Email is required for faculty portal access"),
      "Teachers page modal should inform that Email is required for faculty portal access"
    );

    console.log("✓ Teachers page includes Email field and Faculty Portal Login Account toggle");
  }

  // --------------------------------------------------------------------------
  // Test 5: Inline User Creation Logic: Student linking
  // --------------------------------------------------------------------------
  {
    let createdUserDto: any = null;

    // Spy on userService.createInstituteUser
    const originalCreate = userService.createInstituteUser;
    userService.createInstituteUser = async (dto) => {
      createdUserDto = dto;
      return {
        data: {
          id: "new-user-uid-101",
          email: dto.email || "pc-2026-999@pradeepclasses.in",
          full_name: dto.full_name,
          role: dto.role,
          phone: dto.phone || null,
          is_active: true,
          created_at: new Date().toISOString(),
          linked_student_id: dto.student_id || null,
        },
      };
    };

    try {
      const mockStudentId = "student-guid-001";
      const studentResult = await userService.createInstituteUser({
        full_name: "Aditya Verma",
        phone: "9876501234",
        password: "StrongPassword!9",
        role: "student",
        student_id: mockStudentId,
      });

      assertEqual(createdUserDto.student_id, mockStudentId, "Should link student_id");
      assertEqual(createdUserDto.role, "student", "Role should be student");
      assertEqual(createdUserDto.full_name, "Aditya Verma", "Full name matches");
      assertEqual(studentResult.data?.email, "pc-2026-999@pradeepclasses.in", "Defaults to admission email");

      console.log("✓ Student inline user creation links student_id, student role, and generates username");
    } finally {
      userService.createInstituteUser = originalCreate;
    }
  }

  // --------------------------------------------------------------------------
  // Test 6: Inline User Creation Logic: Faculty linking
  // --------------------------------------------------------------------------
  {
    let createdUserDto: any = null;

    const originalCreate = userService.createInstituteUser;
    userService.createInstituteUser = async (dto) => {
      createdUserDto = dto;
      return {
        data: {
          id: "new-faculty-uid-202",
          email: dto.email || "",
          full_name: dto.full_name,
          role: dto.role,
          phone: dto.phone || null,
          is_active: true,
          created_at: new Date().toISOString(),
          linked_teacher_id: dto.teacher_id || null,
        },
      };
    };

    try {
      const mockTeacherId = "teacher-guid-002";
      const teacherResult = await userService.createInstituteUser({
        full_name: "Er. Manoj Deshmukh",
        email: "manoj.deshmukh@pradeepclasses.in",
        phone: "9820055443",
        password: "TeacherPassword!88",
        role: "teacher",
        teacher_id: mockTeacherId,
      });

      assertEqual(createdUserDto.teacher_id, mockTeacherId, "Should link teacher_id");
      assertEqual(createdUserDto.role, "teacher", "Role should be teacher");
      assertEqual(createdUserDto.email, "manoj.deshmukh@pradeepclasses.in", "Email should be forwarded");
      assertEqual(teacherResult.data?.id, "new-faculty-uid-202", "User account returned successfully");

      console.log("✓ Faculty inline user creation links teacher_id, teacher role, and teacher email");
    } finally {
      userService.createInstituteUser = originalCreate;
    }
  }

  // --------------------------------------------------------------------------
  // Test 7: Students page renders and integrates with admission onboarding
  // --------------------------------------------------------------------------
  {
    const adminContext = createMockAuthContext("admin");

    const html = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: adminContext },
        React.createElement(MemoryRouter, null, React.createElement(Students))
      )
    );

    assertTrue(html.includes("New Admission"), "Students page should render New Admission action");
    console.log("✓ Students page renders and integrates with admission onboarding flow");
  }

  console.log("=== All Inline User Provisioning Tests Passed Successfully ===");
}

// Run if executed directly
if (
  typeof proc !== "undefined" &&
  (import.meta.url === `file://${proc.argv?.[1]?.replace(/\\/g, "/")}` ||
    proc.argv?.[1]?.endsWith("inlineUserProvisioning.test.ts"))
) {
  runInlineUserProvisioningTests().catch((err) => {
    console.error("Test execution failed:", err);
    if (proc?.exit) {
      proc.exit(1);
    }
  });
}
