import { userService, setSupabaseClient } from "../services/userService";
import type { InstituteUser, CreateUserDTO, ResetPasswordDTO } from "../types/user";

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

export async function runUserServiceTests() {
  console.log("=== Running userService Unit Tests ===");

  let mockRpcCalls: { fn: string; params: any }[] = [];
  let mockRpcHandler: (fn: string, params: any) => Promise<{ data: any; error: any }> = async () => ({
    data: null,
    error: null,
  });

  const mockClient = {
    rpc: async (fn: string, params: any) => {
      mockRpcCalls.push({ fn, params });
      return mockRpcHandler(fn, params);
    },
  };

  setSupabaseClient(mockClient);

  const resetMocks = () => {
    mockRpcCalls = [];
    mockRpcHandler = async () => ({ data: null, error: null });
  };

  // --------------------------------------------------------------------------
  // Test 1: listInstituteUsers - formatting and linkages
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const rawUsers = [
      {
        id: "u1111111-1111-1111-1111-111111111111",
        email: "student1@pradeepclasses.in",
        full_name: "Rahul Sharma",
        role: "student",
        phone: "9876543210",
        is_active: true,
        created_at: "2026-11-20T10:00:00Z",
        linked_student_id: "s1111111-1111-1111-1111-111111111111",
        linked_student_name: "Rahul Sharma",
        linked_admission_no: "PC-2026-0001",
        linked_teacher_id: null,
        linked_teacher_name: null,
      },
      {
        id: "u2222222-2222-2222-2222-222222222222",
        email: "teacher1@pradeepclasses.in",
        full_name: "Prof. Verma",
        role: "teacher",
        phone: "9876543211",
        is_active: false,
        created_at: "2026-11-19T10:00:00Z",
        linked_student_id: null,
        linked_student_name: null,
        linked_admission_no: null,
        linked_teacher_id: "t2222222-2222-2222-2222-222222222222",
        linked_teacher_name: "Prof. Verma",
      },
      {
        id: "u3333333-3333-3333-3333-333333333333",
        email: "admin@pradeepclasses.in",
        full_name: "Admin User",
        role: "admin",
        phone: null,
        is_active: true,
        created_at: "2026-11-18T10:00:00Z",
        linked_student_id: null,
        linked_student_name: null,
        linked_admission_no: null,
        linked_teacher_id: null,
        linked_teacher_name: null,
      },
    ];

    mockRpcHandler = async (fn) => {
      if (fn === "admin_list_institute_users") {
        return { data: rawUsers, error: null };
      }
      return { data: null, error: { message: "Unexpected RPC" } };
    };

    const result = await userService.listInstituteUsers();

    assertEqual(result.error, undefined, "listInstituteUsers should have no error");
    assertEqual(result.data.length, 3, "Should return 3 users");

    const studentUser: InstituteUser = result.data[0];
    assertEqual(studentUser.id, "u1111111-1111-1111-1111-111111111111");
    assertEqual(studentUser.email, "student1@pradeepclasses.in");
    assertEqual(studentUser.role, "student");
    assertTrue(studentUser.is_active);
    assertEqual(studentUser.linked_student, {
      id: "s1111111-1111-1111-1111-111111111111",
      full_name: "Rahul Sharma",
      admission_no: "PC-2026-0001",
    });
    assertEqual(studentUser.linked_teacher, null);

    const teacherUser = result.data[1];
    assertEqual(teacherUser.role, "teacher");
    assertEqual(teacherUser.is_active, false);
    assertEqual(teacherUser.linked_teacher, {
      id: "t2222222-2222-2222-2222-222222222222",
      full_name: "Prof. Verma",
    });
    assertEqual(teacherUser.linked_student, null);

    const adminUser = result.data[2];
    assertEqual(adminUser.role, "admin");
    assertEqual(adminUser.linked_student, null);
    assertEqual(adminUser.linked_teacher, null);

    console.log("✓ listInstituteUsers correctly formats users and linkages");
  }

  // --------------------------------------------------------------------------
  // Test 2: listInstituteUsers - error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Unauthorized: Insufficient privileges" },
    });

    const result = await userService.listInstituteUsers();
    assertEqual(result.data, []);
    assertEqual(result.error, "Unauthorized: Insufficient privileges");

    console.log("✓ listInstituteUsers returns error message when RPC fails");
  }

  // --------------------------------------------------------------------------
  // Test 3: createInstituteUser - success with parameters
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const dto: CreateUserDTO = {
      email: "newstudent@pradeepclasses.in",
      password: "TempPassword123!",
      full_name: "Anita Roy",
      role: "student",
      student_id: "s9999999-9999-9999-9999-999999999999",
      phone: "9876543299",
    };

    const mockResponse = {
      status: "success",
      message: "User provisioned successfully",
      id: "u9999999-9999-9999-9999-999999999999",
      email: "newstudent@pradeepclasses.in",
      full_name: "Anita Roy",
      role: "student",
      phone: "9876543299",
      is_active: true,
      linked_student_id: "s9999999-9999-9999-9999-999999999999",
      linked_teacher_id: null,
    };

    mockRpcHandler = async (fn) => {
      if (fn === "admin_create_institute_user") {
        return { data: mockResponse, error: null };
      }
      return { data: null, error: { message: "Unexpected RPC" } };
    };

    const result = await userService.createInstituteUser(dto);

    assertEqual(result.error, undefined);
    assertTrue(Boolean(result.data));
    assertEqual(result.data?.id, "u9999999-9999-9999-9999-999999999999");
    assertEqual(result.data?.email, "newstudent@pradeepclasses.in");
    assertEqual(result.data?.role, "student");
    assertTrue(result.data?.is_active ?? false);
    assertEqual(result.data?.linked_student_id, "s9999999-9999-9999-9999-999999999999");
    assertEqual(result.data?.linked_student_name, "Anita Roy");
    assertEqual(result.data?.linked_teacher_name, null);

    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_create_institute_user");
    assertEqual(mockRpcCalls[0].params, {
      p_email: "newstudent@pradeepclasses.in",
      p_password: "TempPassword123!",
      p_full_name: "Anita Roy",
      p_role: "student",
      p_student_id: "s9999999-9999-9999-9999-999999999999",
      p_teacher_id: null,
      p_phone: "9876543299",
    });

    console.log("✓ createInstituteUser sends exact RPC parameters and returns user");
  }

  // --------------------------------------------------------------------------
  // Test 4: createInstituteUser - auto email when omitted
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const dto: CreateUserDTO = {
      password: "TempPassword123!",
      full_name: "Anita Roy",
      role: "student",
      student_id: "s9999999-9999-9999-9999-999999999999",
    };

    mockRpcHandler = async (_fn, params) => {
      return {
        data: {
          status: "success",
          id: "u9999999-9999-9999-9999-999999999999",
          email: "pc-2026-0002@pradeepclasses.in",
          full_name: "Anita Roy",
          role: "student",
          is_active: true,
          linked_student_id: params.p_student_id,
        },
        error: null,
      };
    };

    const result = await userService.createInstituteUser(dto);

    assertEqual(result.error, undefined);
    assertEqual(result.data?.email, "pc-2026-0002@pradeepclasses.in");
    assertEqual(mockRpcCalls[0].params.p_email, null);

    console.log("✓ createInstituteUser supports null email for student auto-generation");
  }

  // --------------------------------------------------------------------------
  // Test 5: createInstituteUser - error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const dto: CreateUserDTO = {
      email: "existing@pradeepclasses.in",
      password: "Password123!",
      full_name: "Existing User",
      role: "teacher",
    };

    mockRpcHandler = async () => ({
      data: null,
      error: { message: "User with email existing@pradeepclasses.in already exists" },
    });

    const result = await userService.createInstituteUser(dto);
    assertEqual(result.data, null);
    assertEqual(result.error, "User with email existing@pradeepclasses.in already exists");

    console.log("✓ createInstituteUser handles RPC errors correctly");
  }

  // --------------------------------------------------------------------------
  // Test 5b: createInstituteUser - client-side validation without making RPC calls
  // --------------------------------------------------------------------------
  {
    // 1. Empty full name
    resetMocks();
    const resEmptyName = await userService.createInstituteUser({
      full_name: "   ",
      password: "Password123!",
      role: "student",
      student_id: "s1111111-1111-1111-1111-111111111111",
    });
    assertEqual(resEmptyName.data, null);
    assertEqual(resEmptyName.error, "Full name is required.");
    assertEqual(mockRpcCalls.length, 0, "No RPC call should be made for empty full name");

    // 2. Password < 6 chars
    resetMocks();
    const resShortPassword = await userService.createInstituteUser({
      full_name: "Anita Roy",
      password: "12345",
      role: "student",
      student_id: "s1111111-1111-1111-1111-111111111111",
    });
    assertEqual(resShortPassword.data, null);
    assertEqual(resShortPassword.error, "Password must be at least 6 characters long.");
    assertEqual(mockRpcCalls.length, 0, "No RPC call should be made for password < 6 chars");

    // 3. Missing role
    resetMocks();
    const resMissingRole = await userService.createInstituteUser({
      full_name: "Anita Roy",
      password: "Password123!",
      role: "" as any,
      student_id: "s1111111-1111-1111-1111-111111111111",
    });
    assertEqual(resMissingRole.data, null);
    assertEqual(resMissingRole.error, "User role is required.");
    assertEqual(mockRpcCalls.length, 0, "No RPC call should be made for missing role");

    // 4. Missing email when not linked to a student
    resetMocks();
    const resMissingEmail = await userService.createInstituteUser({
      full_name: "Prof. Verma",
      password: "Password123!",
      role: "teacher",
      email: "   ",
    });
    assertEqual(resMissingEmail.data, null);
    assertEqual(resMissingEmail.error, "Email is required when creating a non-student user.");
    assertEqual(mockRpcCalls.length, 0, "No RPC call should be made for non-student without email");

    console.log("✓ createInstituteUser client-side validation blocks invalid calls before RPC");
  }

  // --------------------------------------------------------------------------
  // Test 6: resetUserPassword - success
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const dto: ResetPasswordDTO = {
      userId: "u1111111-1111-1111-1111-111111111111",
      newPassword: "NewSecretPassword456!",
    };

    mockRpcHandler = async (fn) => {
      if (fn === "admin_reset_user_password") {
        return {
          data: { status: "success", message: "Password reset successfully" },
          error: null,
        };
      }
      return { data: null, error: { message: "Unexpected RPC" } };
    };

    const result = await userService.resetUserPassword(dto);
    assertTrue(result.success);
    assertEqual(result.error, undefined);

    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_reset_user_password");
    assertEqual(mockRpcCalls[0].params, {
      p_user_id: "u1111111-1111-1111-1111-111111111111",
      p_new_password: "NewSecretPassword456!",
    });

    console.log("✓ resetUserPassword successfully resets user password");
  }

  // --------------------------------------------------------------------------
  // Test 7: resetUserPassword - error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const dto: ResetPasswordDTO = {
      userId: "u1111111-1111-1111-1111-111111111111",
      newPassword: "short",
    };

    const result = await userService.resetUserPassword(dto);
    assertEqual(result.success, false);
    assertEqual(result.error, "Password must be at least 6 characters long.");

    console.log("✓ resetUserPassword validates password length");
  }

  // --------------------------------------------------------------------------
  // Test 8: toggleUserStatus - success
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn) => {
      if (fn === "admin_toggle_user_status") {
        return {
          data: { status: "success", message: "User status updated" },
          error: null,
        };
      }
      return { data: null, error: { message: "Unexpected RPC" } };
    };

    const result = await userService.toggleUserStatus(
      "u1111111-1111-1111-1111-111111111111",
      false
    );

    assertTrue(result.success);
    assertEqual(result.error, undefined);

    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_toggle_user_status");
    assertEqual(mockRpcCalls[0].params, {
      p_user_id: "u1111111-1111-1111-1111-111111111111",
      p_is_active: false,
    });

    // Test boolean coercion for non-boolean input
    resetMocks();
    await userService.toggleUserStatus("u1111111-1111-1111-1111-111111111111", 1 as any);
    assertEqual(mockRpcCalls[0].params.p_is_active, true);

    console.log("✓ toggleUserStatus sends exact RPC parameters and returns success");
  }

  // --------------------------------------------------------------------------
  // Test 9: toggleUserStatus - error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Cannot toggle active status of yourself" },
    });

    const result = await userService.toggleUserStatus(
      "u1111111-1111-1111-1111-111111111111",
      false
    );

    assertEqual(result.success, false);
    assertEqual(result.error, "Cannot toggle active status of yourself");

    console.log("✓ toggleUserStatus handles RPC errors correctly");
  }

  console.log("=== All userService Unit Tests Passed Successfully ===");
}

// Auto-run if executed directly in Node
const proc = (globalThis as any).process;
if (typeof proc !== "undefined" && proc.argv && proc.argv[1]?.includes("userService.test")) {
  runUserServiceTests().catch((err) => {
    console.error("Test execution failed:", err);
    proc.exit(1);
  });
}
