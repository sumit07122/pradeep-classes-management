import { backupService, setSupabaseClient } from "../services/backupService";
import type {
  InstituteBackupSnapshot,
  InstituteBackupRow,
} from "../types/backup";

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

export async function runBackupServiceTests() {
  console.log("=== Running backupService Unit Tests ===");

  let mockRpcCalls: { fn: string; params: any }[] = [];
  let mockRpcHandler: (fn: string, params: any) => Promise<{ data: any; error: any }> = async () => ({
    data: null,
    error: null,
  });

  let mockTableCalls: { table: string; query: any }[] = [];
  let mockFromHandler: (table: string, query: any) => Promise<{ data: any; error: any }> = async () => ({
    data: [],
    error: null,
  });

  const createQueryBuilder = (table: string) => {
    const queryState: any = { selectedCols: "*", orderCol: "", orderOpts: {}, eqFilters: [] };
    const builder: any = {
      select(cols: string = "*") {
        queryState.selectedCols = cols;
        return builder;
      },
      order(col: string, opts?: any) {
        queryState.orderCol = col;
        queryState.orderOpts = opts;
        return builder;
      },
      eq(col: string, val: any) {
        queryState.eqFilters.push({ col, val });
        return builder;
      },
      single: async () => {
        mockTableCalls.push({ table, query: { ...queryState, isSingle: true } });
        return mockFromHandler(table, { ...queryState, isSingle: true });
      },
      then(resolve: any, reject: any) {
        mockTableCalls.push({ table, query: { ...queryState } });
        return mockFromHandler(table, queryState).then(resolve, reject);
      },
    };
    return builder;
  };

  const mockClient = {
    rpc: async (fn: string, params: any) => {
      mockRpcCalls.push({ fn, params });
      return mockRpcHandler(fn, params);
    },
    from: (table: string) => createQueryBuilder(table),
  };

  setSupabaseClient(mockClient);

  const resetMocks = () => {
    mockRpcCalls = [];
    mockTableCalls = [];
    mockRpcHandler = async () => ({ data: null, error: null });
    mockFromHandler = async () => ({ data: [], error: null });
  };

  // Sample valid snapshot
  const sampleSnapshot: InstituteBackupSnapshot = {
    version: "1.0",
    institute_id: "inst-1111-2222-3333-4444",
    timestamp: "2026-11-22T10:00:00.000Z",
    checksum: "d41d8cd98f00b204e9800998ecf8427e",
    counts: {
      students: 25,
      teachers: 5,
      batches: 4,
    },
    tables: {
      students: [{ id: "s-1", full_name: "Aarav Patel" }],
      teachers: [{ id: "t-1", full_name: "Vikram Sir" }],
      batches: [{ id: "b-1", name: "Grade 10 Science" }],
    },
    backup_id: "backup-uuid-9999",
  };

  // --------------------------------------------------------------------------
  // Test 1: exportBackup - success
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn) => {
      if (fn === "admin_export_institute_backup") {
        return { data: sampleSnapshot, error: null };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    };

    const res = await backupService.exportBackup();
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_export_institute_backup");
    assertTrue(Boolean(res.data), "Expected data returned from exportBackup");
    assertEqual(res.data?.version, "1.0");
    assertEqual(res.data?.institute_id, "inst-1111-2222-3333-4444");
    assertEqual(res.data?.counts.students, 25);
    assertEqual(res.data?.backup_id, "backup-uuid-9999");
    assertEqual(res.error, undefined);

    console.log("✓ exportBackup successfully calls admin_export_institute_backup RPC");
  }

  // --------------------------------------------------------------------------
  // Test 2: exportBackup - RPC error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Unauthorized: Only Owner or Super Admin can export full database backups" },
    });

    const res = await backupService.exportBackup();
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(res.data, undefined);
    assertEqual(
      res.error,
      "Unauthorized: Only Owner or Super Admin can export full database backups"
    );

    console.log("✓ exportBackup handles authorization/RPC errors gracefully");
  }

  // --------------------------------------------------------------------------
  // Test 3: exportBackup - missing client handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    setSupabaseClient(null);

    const res = await backupService.exportBackup();
    assertTrue(Boolean(res.error), "Expected error when client unconfigured");

    // Restore mock client
    setSupabaseClient(mockClient);
    console.log("✓ exportBackup handles unconfigured Supabase client");
  }

  // --------------------------------------------------------------------------
  // Test 4: downloadBackupFile - with provided snapshot and browser DOM simulation
  // --------------------------------------------------------------------------
  {
    resetMocks();
    let appendedChild: any = null;
    let clicked = false;
    let removedChild: any = null;
    let revokedUrl: string | null = null;
    let createdBlobContent: any = null;

    // Setup global window and document mocks
    const origWindow = (globalThis as any).window;
    const origDoc = (globalThis as any).document;
    const origUrl = (globalThis as any).URL;
    const origBlob = (globalThis as any).Blob;

    class MockBlob {
      content: any;
      type: any;
      constructor(content: any, options: any) {
        this.content = content;
        this.type = options?.type;
        createdBlobContent = content;
      }
    }

    const mockAnchor = {
      href: "",
      download: "",
      click() {
        clicked = true;
      },
    };

    (globalThis as any).window = {};
    (globalThis as any).Blob = MockBlob;
    (globalThis as any).URL = {
      createObjectURL: () => "blob:http://localhost/test-uuid",
      revokeObjectURL: (url: string) => {
        revokedUrl = url;
      },
    };
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === "a") return mockAnchor;
        return {};
      },
      body: {
        appendChild: (el: any) => {
          appendedChild = el;
        },
        removeChild: (el: any) => {
          removedChild = el;
        },
      },
    };

    try {
      const res = await backupService.downloadBackupFile(sampleSnapshot);
      assertEqual(res.success, true);
      assertTrue(clicked, "Expected link.click() to have been called");
      assertTrue(Boolean(createdBlobContent), "Expected blob content to be generated");
      assertEqual(appendedChild, mockAnchor);
      assertEqual(removedChild, mockAnchor);
      assertTrue(mockAnchor.download.startsWith("pradeep_classes_backup_"));
      assertTrue(mockAnchor.download.endsWith(".json"));

      // Allow setTimeout revocation to fire
      await new Promise((r) => setTimeout(r, 150));
      assertEqual(revokedUrl, "blob:http://localhost/test-uuid");
    } finally {
      // Cleanup globals
      (globalThis as any).window = origWindow;
      (globalThis as any).document = origDoc;
      (globalThis as any).URL = origUrl;
      (globalThis as any).Blob = origBlob;
    }

    console.log("✓ downloadBackupFile generates browser blob, download anchor, and cleans up");
  }

  // --------------------------------------------------------------------------
  // Test 5: downloadBackupFile - without snapshot parameter (fetches snapshot automatically)
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn) => {
      if (fn === "admin_export_institute_backup") {
        return { data: sampleSnapshot, error: null };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    };

    const res = await backupService.downloadBackupFile();
    assertEqual(res.success, true);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_export_institute_backup");

    console.log("✓ downloadBackupFile automatically triggers exportBackup when snapshot omitted");
  }

  // --------------------------------------------------------------------------
  // Test 6: downloadBackupFile - fails when exportBackup encounters error
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Database export failed" },
    });

    const res = await backupService.downloadBackupFile();
    assertEqual(res.success, false);
    assertEqual(res.error, "Database export failed");

    console.log("✓ downloadBackupFile returns error if automatic export fails");
  }

  // --------------------------------------------------------------------------
  // Test 7: restoreBackup - input validation checks
  // --------------------------------------------------------------------------
  {
    resetMocks();

    // Null / empty
    const res1 = await backupService.restoreBackup(null);
    assertEqual(res1.success, false);
    assertEqual(res1.error, "Backup data is required.");

    // Malformed JSON string
    const res2 = await backupService.restoreBackup("{ malformed json");
    assertEqual(res2.success, false);
    assertTrue(res2.error?.includes("Invalid JSON format") || false);

    // Non-object
    const res3 = await backupService.restoreBackup(["not", "an", "object"]);
    assertEqual(res3.success, false);
    assertEqual(res3.error, "Invalid backup payload: payload must be a JSON object.");

    // Version mismatch
    const res4 = await backupService.restoreBackup({ version: "2.0", tables: {} });
    assertEqual(res4.success, false);
    assertTrue(res4.error?.includes('version "1.0"') || false);

    // Missing tables object
    const res5 = await backupService.restoreBackup({ version: "1.0" });
    assertEqual(res5.success, false);
    assertTrue(res5.error?.includes('valid "tables" object') || false);

    // No RPC calls should have been made for any of these
    assertEqual(mockRpcCalls.length, 0);

    console.log("✓ restoreBackup enforces strict client-side validation before RPC dispatch");
  }

  // --------------------------------------------------------------------------
  // Test 8: restoreBackup - valid payload as parsed object & string
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_restore_institute_backup") {
        return {
          data: {
            success: true,
            message: "Institute backup restored successfully",
            pre_restore_snapshot_id: "pre-snap-uuid-1234",
            restored_counts: params.p_backup_json.counts,
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    };

    // 8a: Pass as object
    const resObj = await backupService.restoreBackup(sampleSnapshot);
    assertEqual(resObj.success, true);
    assertEqual(resObj.snapshotId, "pre-snap-uuid-1234");
    assertEqual(resObj.restoredCounts?.students, 25);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_restore_institute_backup");
    assertEqual(mockRpcCalls[0].params.p_backup_json.version, "1.0");

    // 8b: Pass as JSON string
    mockRpcCalls = [];
    const resStr = await backupService.restoreBackup(JSON.stringify(sampleSnapshot));
    assertEqual(resStr.success, true);
    assertEqual(resStr.snapshotId, "pre-snap-uuid-1234");
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].params.p_backup_json.institute_id, "inst-1111-2222-3333-4444");

    console.log("✓ restoreBackup dispatches validated backup snapshot and returns restore results");
  }

  // --------------------------------------------------------------------------
  // Test 9: restoreBackup - RPC returns error or failure object
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Unauthorized: Backup institute ID does not match caller institute ID" },
    });

    const res = await backupService.restoreBackup(sampleSnapshot);
    assertEqual(res.success, false);
    assertEqual(
      res.error,
      "Unauthorized: Backup institute ID does not match caller institute ID"
    );

    // Also test data.success === false
    resetMocks();
    mockRpcHandler = async () => ({
      data: { success: false, error: "Snapshot restoration aborted" },
      error: null,
    });

    const res2 = await backupService.restoreBackup(sampleSnapshot);
    assertEqual(res2.success, false);
    assertEqual(res2.error, "Snapshot restoration aborted");

    console.log("✓ restoreBackup propagates server restoration errors correctly");
  }

  // --------------------------------------------------------------------------
  // Test 10: listBackups - returns ordered backup logs
  // --------------------------------------------------------------------------
  {
    resetMocks();
    const mockRows: InstituteBackupRow[] = [
      {
        id: "backup-1",
        institute_id: "inst-1",
        backup_type: "manual_export",
        created_at: "2026-11-22T09:00:00Z",
        created_by: "u-owner-1",
        record_counts: { students: 10, teachers: 2 },
        checksum: "abc1234",
        notes: "Manual export via admin_export_institute_backup",
      },
      {
        id: "backup-2",
        institute_id: "inst-1",
        backup_type: "pre_restore_snapshot",
        created_at: "2026-11-21T18:00:00Z",
        created_by: "u-owner-1",
        record_counts: { students: 8, teachers: 2 },
        checksum: "def5678",
        notes: "Automatic pre-restore safety snapshot",
      },
    ];

    mockFromHandler = async (table, query) => {
      if (table === "institute_backups") {
        assertEqual(query.orderCol, "created_at");
        assertEqual(query.orderOpts?.ascending, false);
        return { data: mockRows, error: null };
      }
      return { data: [], error: { message: "Table not found" } };
    };

    const res = await backupService.listBackups();
    assertEqual(res.error, undefined);
    assertEqual(res.data.length, 2);
    assertEqual(res.data[0].id, "backup-1");
    assertEqual(res.data[0].backup_type, "manual_export");
    assertEqual(res.data[1].id, "backup-2");

    console.log("✓ listBackups queries institute_backups table with descending order");
  }

  // --------------------------------------------------------------------------
  // Test 11: listBackups - error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockFromHandler = async () => ({
      data: null,
      error: { message: "Permission denied for table institute_backups" },
    });

    const res = await backupService.listBackups();
    assertEqual(res.data, []);
    assertEqual(res.error, "Permission denied for table institute_backups");

    console.log("✓ listBackups handles database query failures gracefully");
  }

  // --------------------------------------------------------------------------
  // Test 12: undoAuditAction - validation & success
  // --------------------------------------------------------------------------
  {
    resetMocks();

    // 12a: Missing auditId
    const resEmpty = await backupService.undoAuditAction("");
    assertEqual(resEmpty.success, false);
    assertEqual(resEmpty.error, "Audit ID is required.");
    assertEqual(mockRpcCalls.length, 0);

    // 12b: Success
    mockRpcHandler = async (fn, params) => {
      if (fn === "admin_undo_audit_action") {
        assertEqual(params.p_audit_id, "audit-log-uuid-1111");
        return {
          data: {
            success: true,
            action: "DELETE_STUDENT",
            table_name: "students",
            reverted_record_id: "s-1111",
            message: "Audit action successfully reverted and record restored",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    };

    const resSuccess = await backupService.undoAuditAction("audit-log-uuid-1111");
    assertEqual(resSuccess.success, true);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_undo_audit_action");

    console.log("✓ undoAuditAction validates audit ID and dispatches admin_undo_audit_action");
  }

  // --------------------------------------------------------------------------
  // Test 13: undoAuditAction - already reverted or not found
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: {
        success: false,
        error: "This action has already been reverted",
      },
      error: null,
    });

    const res = await backupService.undoAuditAction("audit-log-uuid-2222");
    assertEqual(res.success, false);
    assertEqual(res.error, "This action has already been reverted");

    // Test RPC error
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Unauthorized: Audit log entry belongs to another institute" },
    });

    const res2 = await backupService.undoAuditAction("audit-log-uuid-3333");
    assertEqual(res2.success, false);
    assertEqual(
      res2.error,
      "Unauthorized: Audit log entry belongs to another institute"
    );

    console.log("✓ undoAuditAction handles already-reverted and unauthorized errors");
  }

  // --------------------------------------------------------------------------
  // Test 14: purgeDemoData - success & pre-purge snapshot
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async (fn) => {
      if (fn === "admin_purge_demo_data") {
        return {
          data: {
            success: true,
            message: "Demo data successfully purged. Institute is ready for clean onboarding.",
            snapshot_id: "snap-pre-purge-1111",
            purged_counts: { students: 10, teachers: 3 },
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Unknown RPC" } };
    };

    const res = await backupService.purgeDemoData();
    assertEqual(res.success, true);
    assertEqual(res.snapshotId, "snap-pre-purge-1111");
    assertEqual(res.purgedCounts?.students, 10);
    assertEqual(res.purgedCounts?.teachers, 3);
    assertEqual(mockRpcCalls.length, 1);
    assertEqual(mockRpcCalls[0].fn, "admin_purge_demo_data");

    console.log("✓ purgeDemoData dispatches admin_purge_demo_data RPC and preserves snapshot metadata");
  }

  // --------------------------------------------------------------------------
  // Test 15: purgeDemoData - RPC error handling
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockRpcHandler = async () => ({
      data: null,
      error: { message: "Unauthorized: Only Owner or Super Admin can purge demo data" },
    });

    const res = await backupService.purgeDemoData();
    assertEqual(res.success, false);
    assertEqual(
      res.error,
      "Unauthorized: Only Owner or Super Admin can purge demo data"
    );

    console.log("✓ purgeDemoData handles unauthorized RPC errors");
  }

  // --------------------------------------------------------------------------
  // Test 16: getBackupSnapshot - retrieves snapshot data by ID
  // --------------------------------------------------------------------------
  {
    resetMocks();
    mockFromHandler = async (table: string, query: any) => {
      assertEqual(table, "institute_backups");
      assertEqual(query.selectedCols, "snapshot_data");
      assertEqual(query.eqFilters, [{ col: "id", val: "b-111" }]);
      return {
        data: { snapshot_data: sampleSnapshot },
        error: null,
      };
    };

    const res = await backupService.getBackupSnapshot("b-111");
    assertEqual(res.data?.version, "1.0");
    assertEqual(res.data?.institute_id, "inst-1111-2222-3333-4444");

    const resEmpty = await backupService.getBackupSnapshot("");
    assertEqual(resEmpty.error, "Backup ID is required.");

    console.log("✓ getBackupSnapshot fetches snapshot data by ID and validates inputs");
  }

  console.log("=== All backupService Unit Tests Passed Successfully ===");
}

// Auto-run if executed directly in Node
const proc = (globalThis as any).process;
if (typeof proc !== "undefined" && proc.argv && proc.argv[1]?.includes("backupService.test")) {
  runBackupServiceTests().catch((err) => {
    console.error("Test execution failed:", err);
    proc.exit(1);
  });
}
