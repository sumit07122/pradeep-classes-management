import { teachersService } from "../services/teachersService";
import { studentsService } from "../services/studentsService";
import { batchesService } from "../services/batchesService";
import { financeService } from "../services/financeService";

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

export async function runErpLifecycleTests() {
  console.log("=== Running ERP Lifecycle Services Unit Tests ===");

  let mockRpcCalls: { fn: string; params: any }[] = [];
  let mockRpcHandler: (fn: string, params: any) => Promise<{ data: any; error: any }> = async () => ({
    data: null,
    error: null,
  });

  let mockTableUpdates: { table: string; payload: any; eqCol: string; eqVal: any }[] = [];
  let mockUpdateHandler: (table: string, payload: any) => Promise<{ data: any; error: any }> = async () => ({
    data: null,
    error: null,
  });

  const mockClient = {
    rpc: async (fn: string, params: any) => {
      mockRpcCalls.push({ fn, params });
      return mockRpcHandler(fn, params);
    },
    from: (table: string) => ({
      update: (payload: any) => ({
        eq: async (eqCol: string, eqVal: any) => {
          mockTableUpdates.push({ table, payload, eqCol, eqVal });
          return mockUpdateHandler(table, payload);
        },
      }),
    }),
  };

  teachersService.setSupabaseClient(mockClient);
  studentsService.setSupabaseClient(mockClient);
  batchesService.setSupabaseClient(mockClient);
  financeService.setSupabaseClient(mockClient);

  const resetMocks = () => {
    mockRpcCalls = [];
    mockTableUpdates = [];
    mockRpcHandler = async () => ({ data: null, error: null });
    mockUpdateHandler = async () => ({ data: null, error: null });
  };

  // --------------------------------------------------------------------------
  // Test 1: teachersService.deleteTeacher - Safe delete blocked by historical records
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_delete_teacher" && !params.p_force_cascade) {
        return {
          data: null,
          error: {
            message:
              "Cannot delete faculty member with 1 historical payroll record(s). Please deactivate them instead to preserve financial and tax records.",
          },
        };
      }
      return { data: { success: true }, error: null };
    };

    const res = await teachersService.deleteTeacher("t-123", false);
    assertEqual(res.success, false);
    assertTrue(
      res.error?.includes("Cannot delete faculty member with 1 historical payroll record(s)") || false
    );
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0], {
      fn: "admin_delete_teacher",
      params: { p_teacher_id: "t-123", p_force_cascade: false },
    });

    console.log("✓ teachersService.deleteTeacher sends safe deletion flag and surfaces blocking error");
  }

  // --------------------------------------------------------------------------
  // Test 2: teachersService.deleteTeacher - Force cascade deletion
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_delete_teacher" && params.p_force_cascade) {
        return {
          data: {
            success: true,
            deleted_id: params.p_teacher_id,
            message: "Faculty member and all related academic/payroll records permanently removed",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unexpected call" } };
    };

    const res = await teachersService.deleteTeacher("t-123", true);
    assertEqual(res.success, true);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].params.p_force_cascade, true);

    console.log("✓ teachersService.deleteTeacher successfully executes force cascade deletion");
  }

  // --------------------------------------------------------------------------
  // Test 3: teachersService.updateTeacherStatus
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const res = await teachersService.updateTeacherStatus(
      "t-123",
      "relieved",
      "Moved to higher studies",
      "2026-11-30"
    );
    assertEqual(res.success, true);
    assertEqual(mockTableUpdates.length, 1);
    assertEqual(mockTableUpdates[0].table, "teachers");
    assertEqual(mockTableUpdates[0].eqVal, "t-123");
    assertEqual(mockTableUpdates[0].payload.status, "relieved");
    assertEqual(mockTableUpdates[0].payload.status_reason, "Moved to higher studies");
    assertEqual(mockTableUpdates[0].payload.relieving_date, "2026-11-30");
    assertEqual(mockTableUpdates[0].payload.is_active, false);

    console.log("✓ teachersService.updateTeacherStatus updates lifecycle fields and deactivates teacher");
  }

  // --------------------------------------------------------------------------
  // Test 4: studentsService.deleteStudent - Safe delete blocked by fee records
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_delete_student" && !params.p_force_cascade) {
        return {
          data: null,
          error: {
            message:
              "Cannot delete student with 2 fee payments. Please archive the student instead to maintain accounting auditability.",
          },
        };
      }
      return { data: { success: true }, error: null };
    };

    const res = await studentsService.deleteStudent("s-456", false);
    assertEqual(res.success, false);
    assertTrue(res.error?.includes("Cannot delete student with 2 fee payments") || false);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0], {
      fn: "admin_delete_student",
      params: { p_student_id: "s-456", p_force_cascade: false },
    });

    console.log("✓ studentsService.deleteStudent sends safe deletion flag and surfaces blocking error");
  }

  // --------------------------------------------------------------------------
  // Test 5: studentsService.deleteStudent - Force cascade deletion
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_delete_student" && params.p_force_cascade) {
        return {
          data: {
            success: true,
            deleted_id: params.p_student_id,
            message: "Student and all dependent academic/financial data permanently removed",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unexpected call" } };
    };

    const res = await studentsService.deleteStudent("s-456", true);
    assertEqual(res.success, true);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].params.p_force_cascade, true);

    console.log("✓ studentsService.deleteStudent executes force cascade deletion cleanly");
  }

  // --------------------------------------------------------------------------
  // Test 6: studentsService.updateStudentStatus - Rusticated with reason note
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const res = await studentsService.updateStudentStatus(
      "s-456",
      "rusticated",
      "Repeated disciplinary violations after parental warning",
      "2026-11-22"
    );
    assertEqual(res.success, true);
    assertEqual(mockTableUpdates.length, 1);
    assertEqual(mockTableUpdates[0].table, "students");
    assertEqual(mockTableUpdates[0].eqVal, "s-456");
    assertEqual(mockTableUpdates[0].payload.status, "rusticated");
    assertEqual(
      mockTableUpdates[0].payload.status_reason,
      "Repeated disciplinary violations after parental warning"
    );
    assertEqual(mockTableUpdates[0].payload.exit_date, "2026-11-22");

    console.log("✓ studentsService.updateStudentStatus updates canonical status and exit date");
  }

  // --------------------------------------------------------------------------
  // Test 7: batchesService.deleteBatch - Safe and cascade deletion
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_delete_batch") {
        if (!params.p_force_cascade) {
          return {
            data: null,
            error: {
              message:
                "Cannot delete batch: 15 active students currently enrolled. Transfer students first or use force cascade.",
            },
          };
        }
        return {
          data: {
            success: true,
            deleted_id: params.p_batch_id,
            message: "Batch and all related schedules permanently removed",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unexpected call" } };
    };

    const blockedRes = await batchesService.deleteBatch("b-789", false);
    assertEqual(blockedRes.success, false);
    assertTrue(blockedRes.error?.includes("Cannot delete batch: 15 active students") || false);

    const cascadeRes = await batchesService.deleteBatch("b-789", true);
    assertEqual(cascadeRes.success, true);
    assertEqual(mockRpcCalls.length, 2);

    console.log("✓ batchesService.deleteBatch handles both safe enrollment guard and force cascade");
  }

  // --------------------------------------------------------------------------
  // Test 8: financeService.deleteTeacherPayroll - Single record removal
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_delete_payroll_record") {
        return {
          data: {
            success: true,
            deleted_id: params.p_payroll_id,
            message: "Payroll record successfully deleted",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unexpected call" } };
    };

    const emptyRes = await financeService.deleteTeacherPayroll("");
    assertEqual(emptyRes.success, false);
    assertEqual(emptyRes.error, "Payroll ID is required.");

    const res = await financeService.deleteTeacherPayroll("p-999");
    assertEqual(res.success, true);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0], {
      fn: "admin_delete_payroll_record",
      params: { p_payroll_id: "p-999" },
    });

    console.log("✓ financeService.deleteTeacherPayroll dispatches atomic payroll deletion");
  }

  console.log("=== All ERP Lifecycle Services Unit Tests Passed Successfully ===");
}

// Auto-run if executed directly in Node
const proc = (globalThis as any).process;
if (typeof proc !== "undefined" && proc.argv && proc.argv[1]?.includes("erpLifecycleServices.test")) {
  runErpLifecycleTests().catch((err) => {
    console.error("Test execution failed:", err);
    proc.exit(1);
  });
}
