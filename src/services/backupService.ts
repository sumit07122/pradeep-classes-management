import type {
  InstituteBackupSnapshot,
  InstituteBackupRow,
  BackupOperationResult,
} from "../types/backup";
import { supabase } from "../lib/supabase";

let mockClient: any = null;

/**
 * For testing purposes: inject a mock Supabase client
 */
export function setSupabaseClient(client: any) {
  mockClient = client;
}

function getClient(): any {
  return mockClient || supabase;
}

/**
 * Trigger server-side institute backup generation via admin_export_institute_backup RPC.
 * Creates a persisted snapshot record and returns the complete snapshot JSON.
 */
export async function exportBackup(): Promise<{
  data?: InstituteBackupSnapshot;
  error?: string;
}> {
  try {
    const client = await getClient();
    if (!client) {
      return { error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_export_institute_backup");

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return { error: "No backup data returned from server." };
    }

    return { data: data as InstituteBackupSnapshot };
  } catch (err: any) {
    return { error: err?.message || "Failed to export institute backup." };
  }
}

/**
 * Downloads a snapshot as a formatted JSON file.
 * If snapshot is not provided, exports a new backup first.
 */
export async function downloadBackupFile(
  snapshot?: InstituteBackupSnapshot
): Promise<{ success: boolean; error?: string }> {
  try {
    let payload = snapshot;
    if (!payload) {
      const exportRes = await exportBackup();
      if (exportRes.error || !exportRes.data) {
        return {
          success: false,
          error: exportRes.error || "Failed to export backup for download.",
        };
      }
      payload = exportRes.data;
    }

    const jsonStr = JSON.stringify(payload, null, 2);
    const dateStr = payload.timestamp
      ? payload.timestamp.replace(/[:.]/g, "-")
      : new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `pradeep_classes_backup_${dateStr}.json`;

    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      const container = document.body || document.documentElement;
      if (container && typeof container.appendChild === "function") {
        container.appendChild(link);
        link.click();
        container.removeChild(link);
      } else {
        link.click();
      }
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 100);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to download backup file.",
    };
  }
}

/**
 * Restores institute database from a valid JSON backup snapshot.
 * Performs client-side structural validation before invoking admin_restore_institute_backup.
 */
export async function restoreBackup(
  backupJson: any
): Promise<BackupOperationResult> {
  try {
    if (!backupJson) {
      return { success: false, error: "Backup data is required." };
    }

    let parsed: any = backupJson;
    if (typeof backupJson === "string") {
      try {
        parsed = JSON.parse(backupJson);
      } catch (e: any) {
        return {
          success: false,
          error: `Invalid JSON format: ${e?.message || "parse error"}`,
        };
      }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        success: false,
        error: "Invalid backup payload: payload must be a JSON object.",
      };
    }

    if (parsed.version !== "1.0") {
      return {
        success: false,
        error:
          'Invalid backup payload: must be JSON with version "1.0" and a valid "tables" object',
      };
    }

    if (
      !parsed.tables ||
      typeof parsed.tables !== "object" ||
      Array.isArray(parsed.tables)
    ) {
      return {
        success: false,
        error:
          'Invalid backup payload: must be JSON with version "1.0" and a valid "tables" object',
      };
    }

    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_restore_institute_backup", {
      p_backup_json: parsed,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.success === false) {
      return {
        success: false,
        error: data.error || data.message || "Failed to restore backup.",
      };
    }

    return {
      success: true,
      message: data?.message || "Institute backup restored successfully",
      restoredCounts: data?.restored_counts,
      snapshotId: data?.pre_restore_snapshot_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to restore institute backup.",
    };
  }
}

/**
 * Retrieves the historical backup logs for the institute.
 */
export async function listBackups(): Promise<{
  data: InstituteBackupRow[];
  error?: string;
}> {
  try {
    const client = await getClient();
    if (!client) {
      return { data: [], error: "Supabase client is not configured." };
    }

    const { data, error } = await client
      .from("institute_backups")
      .select(
        "id, institute_id, backup_type, created_at, created_by, record_counts, checksum, notes"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data || []) as InstituteBackupRow[] };
  } catch (err: any) {
    return { data: [], error: err?.message || "Failed to list backups." };
  }
}

/**
 * Fetches full snapshot JSON for a specific backup ID (for download or inspection).
 */
export async function getBackupSnapshot(
  backupId: string
): Promise<{ data?: InstituteBackupSnapshot; error?: string }> {
  try {
    if (!backupId || typeof backupId !== "string" || backupId.trim() === "") {
      return { error: "Backup ID is required." };
    }
    const client = await getClient();
    if (!client) {
      return { error: "Supabase client is not configured." };
    }
    const { data, error } = await client
      .from("institute_backups")
      .select("snapshot_data")
      .eq("id", backupId.trim())
      .single();

    if (error) {
      return { error: error.message };
    }
    return { data: data?.snapshot_data as InstituteBackupSnapshot };
  } catch (err: any) {
    return { error: err?.message || "Failed to fetch backup snapshot." };
  }
}

/**
 * Reverts a destructive or state-changing action using the immutable audit trail snapshot.
 */
export async function undoAuditAction(
  auditId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!auditId || typeof auditId !== "string" || auditId.trim() === "") {
      return { success: false, error: "Audit ID is required." };
    }

    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_undo_audit_action", {
      p_audit_id: auditId.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.success === false) {
      return {
        success: false,
        error: data.error || data.message || "Failed to revert action.",
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to revert audit action.",
    };
  }
}

/**
 * Purges mock/demo data for pristine production clean handover.
 * Automatically takes a safety pre_purge_snapshot before clearing records.
 */
export async function purgeDemoData(): Promise<BackupOperationResult> {
  try {
    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_purge_demo_data");

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.success === false) {
      return {
        success: false,
        error: data.error || data.message || "Failed to purge demo data.",
      };
    }

    return {
      success: true,
      message: data?.message || "Demo data successfully purged",
      snapshotId: data?.snapshot_id,
      purgedCounts: data?.purged_counts,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to purge demo data.",
    };
  }
}

/**
 * Retrieves recent audit logs for the undo/revert hub.
 */
export async function listAuditLogs(
  limit: number = 20
): Promise<{ data: any[]; error?: string }> {
  try {
    const client = await getClient();
    if (!client) {
      return { data: [], error: "Supabase client is not configured." };
    }
    const { data, error } = await client
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, previous_state, new_state, is_reverted, performed_at, performed_by")
      .order("performed_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message };
    }
    return { data: data || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || "Failed to list audit logs." };
  }
}

export const backupService = {
  exportBackup,
  downloadBackupFile,
  restoreBackup,
  listBackups,
  getBackupSnapshot,
  undoAuditAction,
  purgeDemoData,
  listAuditLogs,
  setSupabaseClient,
};
