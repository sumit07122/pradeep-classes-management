export type BackupType =
  | 'automated_daily'
  | 'manual_export'
  | 'pre_restore_snapshot'
  | 'pre_purge_snapshot';

export interface InstituteBackupRow {
  id: string;
  institute_id: string;
  backup_type: BackupType;
  created_at: string;
  created_by: string | null;
  record_counts: Record<string, number>;
  snapshot_data?: any;
  checksum: string;
  notes: string | null;
}

export interface InstituteBackupSnapshot {
  version: string;
  institute_id: string;
  timestamp: string;
  checksum: string;
  counts: Record<string, number>;
  tables: Record<string, any[]>;
  backup_id?: string;
}

export interface BackupOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  snapshotId?: string;
  restoredCounts?: Record<string, number>;
  purgedCounts?: Record<string, number>;
}
