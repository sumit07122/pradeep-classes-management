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

export async function runBatchesAndPayrollTests() {
  console.log("=== Running Batches & Payroll Lifecycle Unit Tests ===");

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
    from: () => ({
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
      delete: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }),
  };

  batchesService.setSupabaseClient?.(mockClient as any);
  financeService.setSupabaseClient?.(mockClient as any);

  // Test 1: Batch deletion blocked when students enrolled without force_cascade
  mockRpcCalls = [];
  mockRpcHandler = async (fn, params) => {
    if (fn === "admin_delete_batch") {
      if (!params.p_force_cascade) {
        return {
          data: {
            success: false,
            error: "Cannot delete batch with 18 enrolled students. Reallocate students or pass force_cascade=true.",
            enrolled_students: 18,
          },
          error: null,
        };
      }
      return {
        data: {
          success: true,
          message: "Batch and 18 student allocations deleted successfully.",
        },
        error: null,
      };
    }
    return { data: null, error: null };
  };

  const safeDelRes = await batchesService.deleteBatch("batch-101", false);
  assertEqual(Boolean(safeDelRes.success), false, "Safe batch deletion should fail when students enrolled");
  assertTrue(Boolean(safeDelRes.error?.includes("18 enrolled students")), "Error should cite enrolled count");

  // Test 2: Batch force cascade deletion
  const forceDelRes = await batchesService.deleteBatch("batch-101", true);
  assertEqual(Boolean(forceDelRes.success), true, "Force cascade batch deletion should succeed");
  assertEqual(mockRpcCalls[1]?.params?.p_force_cascade, true, "force_cascade must be passed to RPC");

  // Test 3: Teacher payroll sheet deletion with ledger reverse
  mockRpcCalls = [];
  mockRpcHandler = async (fn, params) => {
    if (fn === "admin_delete_payroll_record") {
      return {
        data: {
          success: true,
          message: "Payroll sheet and associated ledger entry deleted successfully.",
          deleted_expense_id: "exp-777",
          deleted_payroll_id: params.p_payroll_id,
        },
        error: null,
      };
    }
    return { data: null, error: null };
  };

  const payrollDelRes = await financeService.deleteTeacherPayroll("pyr-123");
  assertEqual(Boolean(payrollDelRes.success), true, "Payroll sheet deletion should succeed");
  assertEqual(mockRpcCalls[0]?.fn, "admin_delete_payroll_record", "Must invoke admin_delete_payroll_record RPC");
  assertEqual(mockRpcCalls[0]?.params?.p_payroll_id, "pyr-123", "Must pass target payroll ID");

  console.log("All 3 Batches & Payroll lifecycle tests passed successfully!");
}

runBatchesAndPayrollTests().catch((err) => {
  console.error("Test failure:", err);
  throw err;
});
