import { backupService } from "../services/backupService";

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

export async function runBackupAndHandoverTests() {
  console.log("=== Running Backup & Recovery Handover Unit Tests ===");

  let mockRpcCalls: { fn: string; params?: any }[] = [];
  let mockRpcHandler: (fn: string, params?: any) => Promise<{ data: any; error: any }> = async () => ({
    data: null,
    error: null,
  });

  const mockClient = {
    rpc: async (fn: string, params?: any) => {
      mockRpcCalls.push({ fn, params });
      return mockRpcHandler(fn, params);
    },
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: async (num: number) => {
            if (table === "audit_logs") {
              return {
                data: [
                  {
                    id: "log-1",
                    action: "delete",
                    entity_type: "students",
                    entity_id: "s-100",
                    is_reverted: false,
                    performed_at: "2026-11-22T10:00:00Z",
                  },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          },
        }),
      }),
    }),
  };

  backupService.setSupabaseClient(mockClient);

  // Test 1: listAuditLogs correctly returns recent actions
  const auditRes = await backupService.listAuditLogs(10);
  assertEqual(auditRes.data?.length, 1, "Should return 1 audit record");
  assertEqual(auditRes.data?.[0]?.action, "delete", "Audit action should be delete");

  // Test 2: restoreBackup validates snapshot integrity before touching RPC
  const invalidRestore = await backupService.restoreBackup({ version: "0.9" });
  assertEqual(invalidRestore.success, false, "Should reject snapshot without version 1.0");
  assertTrue(
    Boolean(invalidRestore.error?.includes('version "1.0"')),
    "Error should state version requirement"
  );

  // Test 3: restoreBackup invokes admin_restore_institute_backup with valid payload
  mockRpcCalls = [];
  mockRpcHandler = async (fn, params) => {
    if (fn === "admin_restore_institute_backup") {
      return {
        data: {
          success: true,
          message: "Institute backup restored successfully",
          restored_counts: { students: 10, teachers: 5 },
          pre_restore_snapshot_id: "snap-pre-restore-999",
        },
        error: null,
      };
    }
    return { data: null, error: null };
  };

  const validSnapshot = {
    version: "1.0",
    timestamp: "2026-11-22T12:00:00Z",
    institute_id: "11111111-2222-3333-4444-555555555555",
    tables: {
      students: [{ id: "s-1", full_name: "Test Student" }],
    },
  };

  const validRestore = await backupService.restoreBackup(validSnapshot);
  assertEqual(validRestore.success, true, "Valid restore should succeed");
  assertEqual(mockRpcCalls[0]?.fn, "admin_restore_institute_backup", "Must call restore RPC");

  // Test 4: purgeDemoData calls admin_purge_demo_data and returns counts
  mockRpcCalls = [];
  mockRpcHandler = async (fn) => {
    if (fn === "admin_purge_demo_data") {
      return {
        data: {
          success: true,
          message: "Demo data successfully purged",
          snapshot_id: "snap-pre-purge-888",
          purged_counts: {
            students: 3,
            teachers: 3,
            batches: 2,
          },
        },
        error: null,
      };
    }
    return { data: null, error: null };
  };

  const purgeRes = await backupService.purgeDemoData();
  assertEqual(purgeRes.success, true, "Purge demo data should succeed");
  assertEqual(mockRpcCalls[0]?.fn, "admin_purge_demo_data", "Must call admin_purge_demo_data RPC");
  assertEqual(purgeRes.purgedCounts?.students, 3, "Purged students count must match");

  // Test 5: undoAuditAction calls admin_undo_audit_action RPC
  mockRpcCalls = [];
  mockRpcHandler = async (fn, params) => {
    if (fn === "admin_undo_audit_action") {
      return {
        data: {
          success: true,
          message: "Action successfully reverted from audit trail.",
        },
        error: null,
      };
    }
    return { data: null, error: null };
  };

  const undoRes = await backupService.undoAuditAction("log-1");
  assertEqual(undoRes.success, true, "Undo audit action should succeed");
  assertEqual(mockRpcCalls[0]?.fn, "admin_undo_audit_action", "Must call admin_undo_audit_action RPC");
  assertEqual(mockRpcCalls[0]?.params?.p_audit_id, "log-1", "Must pass audit id to RPC");

  console.log("All 5 Backup & Recovery tests passed successfully!");
}

runBackupAndHandoverTests().catch((err) => {
  console.error("Test failure:", err);
  throw err;
});
