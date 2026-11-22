import React, { useState, useEffect } from "react";
import {
  Download,
  Upload,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Database,
  Trash2,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button, Input, Badge } from "../common";
import { backupService } from "../../services/backupService";
import { useAuth } from "../../hooks/useAuth";
import type { InstituteBackupRow, InstituteBackupSnapshot } from "../../types/backup";

export const BackupAndRecoveryTab: React.FC = () => {
  const { role } = useAuth();
  const isOwnerOrSuper = ["owner", "super_admin"].includes(role);

  // Status & loading states
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<InstituteBackupRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Backup state
  const [isExporting, setIsExporting] = useState(false);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<InstituteBackupSnapshot | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  // Undo state
  const [revertingLogId, setRevertingLogId] = useState<string | null>(null);

  // Purge demo data state
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupsRes, auditRes] = await Promise.all([
        backupService.listBackups(),
        backupService.listAuditLogs(15),
      ]);
      setBackups(backupsRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (err: any) {
      console.error("Error loading backup tab data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportBackup = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const res = await backupService.downloadBackupFile();
      if (!res.success) {
        setMessage({ text: res.error || "Failed to download backup.", type: "error" });
      } else {
        setMessage({ text: "Institute backup snapshot successfully downloaded.", type: "success" });
        await loadData();
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to export backup.", type: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) {
      setRestoreFile(null);
      setParsedSnapshot(null);
      return;
    }

    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.version || !json.tables) {
          setMessage({
            text: 'Invalid backup file format: must include version "1.0" and tables object.',
            type: "error",
          });
          setParsedSnapshot(null);
          return;
        }
        setParsedSnapshot(json);
      } catch (err: any) {
        setMessage({
          text: `Failed to parse backup JSON: ${err.message}`,
          type: "error",
        });
        setParsedSnapshot(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!parsedSnapshot) return;
    if (restoreConfirmText.trim() !== "RESTORE") {
      setMessage({
        text: 'Please type "RESTORE" to confirm restoring from the uploaded snapshot.',
        type: "error",
      });
      return;
    }

    setIsRestoring(true);
    setMessage(null);
    try {
      const res = await backupService.restoreBackup(parsedSnapshot);
      if (!res.success) {
        setMessage({ text: res.error || "Failed to restore backup snapshot.", type: "error" });
      } else {
        setMessage({
          text: `Success: Institute data restored successfully! Pre-restore rollback snapshot saved.`,
          type: "success",
        });
        setRestoreFile(null);
        setParsedSnapshot(null);
        setRestoreConfirmText("");
        await loadData();
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Error restoring backup.", type: "error" });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUndo = async (logId: string) => {
    setRevertingLogId(logId);
    setMessage(null);
    try {
      const res = await backupService.undoAuditAction(logId);
      if (!res.success) {
        setMessage({ text: res.error || "Failed to revert action.", type: "error" });
      } else {
        setMessage({ text: "Action successfully reverted from audit trail.", type: "success" });
        await loadData();
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Error reverting action.", type: "error" });
    } finally {
      setRevertingLogId(null);
    }
  };

  const handleDownloadHistoricalSnapshot = async (id: string) => {
    try {
      const res = await backupService.getBackupSnapshot(id);
      if (res.error || !res.data) {
        setMessage({ text: res.error || "Failed to load snapshot.", type: "error" });
        return;
      }
      await backupService.downloadBackupFile(res.data);
    } catch (err: any) {
      setMessage({ text: err.message || "Error downloading historical snapshot.", type: "error" });
    }
  };

  const handlePurgeDemoData = async () => {
    if (purgeConfirmText.trim() !== "PURGE DEMO DATA") {
      setMessage({
        text: 'Please type "PURGE DEMO DATA" exactly to confirm.',
        type: "error",
      });
      return;
    }

    setIsPurging(true);
    setMessage(null);
    try {
      const res = await backupService.purgeDemoData();
      if (!res.success) {
        setMessage({ text: res.error || "Failed to purge demo data.", type: "error" });
      } else {
        setPurgeResult(res);
        setPurgeConfirmText("");
        setMessage({
          text: "Demo data has been purged successfully! Database is now a clean slate for real Pradeep Classes onboarding.",
          type: "success",
        });
        await loadData();
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Error purging demo data.", type: "error" });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#102f50]/10 text-[#102f50]">
            <Database size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Automated Snapshots
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              Daily Automated
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              30-day cloud retention with cryptographic integrity
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
            <RotateCcw size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Action Reversibility
            </div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">
              Undo / Redo Enabled
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Rollback accidental edits or deletions in 1 click
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pre-Action Protection
            </div>
            <div className="text-lg font-bold text-indigo-700 mt-0.5">
              Safe Deletions
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Automatic pre-restore & pre-purge rollback snapshots
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Instant Backup & Disaster Snapshot */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Download size={18} className="text-[#16466f]" />
              Instant Full Database Backup
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Export an encrypted, standalone JSON snapshot containing all students, faculty, batches, fee records, attendance, and configs.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleExportBackup}
            isLoading={isExporting}
            icon={<Download size={16} />}
            className="bg-[#102f50] hover:bg-[#16466f] text-white shrink-0"
          >
            Download Full Snapshot (.json)
          </Button>
        </div>

        {/* Section 2: Crisis Recovery & Snapshot Restore */}
        <div className="pt-2 space-y-3">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Upload size={16} className="text-amber-600" />
            Crisis Recovery: Restore from Snapshot
          </h4>
          <p className="text-xs text-slate-500">
            In case of emergency, hardware loss, or corruption, upload a previously downloaded `.json` snapshot to restore institute state.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-1">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Select Backup File (.json)
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded-lg p-1.5"
              />
            </div>

            {parsedSnapshot && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileCheck size={15} className="text-emerald-600" />
                  <span>Valid Snapshot: {restoreFile?.name || "Uploaded File"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                  <div>Timestamp: {parsedSnapshot.timestamp?.substring(0, 16) || "N/A"}</div>
                  <div>Version: {parsedSnapshot.version}</div>
                  <div>Students: {parsedSnapshot.tables?.students?.length || 0}</div>
                  <div>Teachers: {parsedSnapshot.tables?.teachers?.length || 0}</div>
                  <div>Batches: {parsedSnapshot.tables?.batches?.length || 0}</div>
                  <div>Fee Txns: {parsedSnapshot.tables?.fee_transactions?.length || 0}</div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <p className="text-[11px] text-amber-800 font-semibold">
                    Type <strong>RESTORE</strong> to confirm database recovery:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={restoreConfirmText}
                      onChange={(e) => setRestoreConfirmText(e.target.value)}
                      placeholder="RESTORE"
                      className="text-xs"
                    />
                    <Button
                      variant="primary"
                      onClick={handleExecuteRestore}
                      isLoading={isRestoring}
                      disabled={restoreConfirmText.trim() !== "RESTORE"}
                      className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs"
                    >
                      Restore Database
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Audit Trail & 1-Click Revert / Undo */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw size={18} className="text-emerald-600" />
              Activity Stream & 1-Click Undo
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review recent administrative operations. If an accidental deletion or modification occurred, revert it instantly.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />}
            className="text-xs text-slate-600 border-slate-200"
          >
            Refresh
          </Button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No audit records logged yet. Operations will appear here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => {
                  const dateStr = log.performed_at
                    ? new Date(log.performed_at).toLocaleString("en-IN")
                    : "Recent";
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 capitalize">
                        {log.action?.replace(/_/g, " ")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {log.is_reverted ? (
                          <Badge variant="neutral" size="sm">
                            Reverted
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!log.is_reverted && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUndo(log.id)}
                            isLoading={revertingLogId === log.id}
                            className="text-[11px] py-1 px-2.5 border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <RotateCcw size={11} className="mr-1" />
                            Undo
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Cloud Snapshot Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock size={18} className="text-[#16466f]" />
            Historical Cloud Snapshots ({backups.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated and manual snapshots stored securely in Supabase storage for rollback and audits.
          </p>
        </div>

        {backups.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No historical cloud snapshots yet. Take a snapshot above to initialize the registry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Created Date</th>
                  <th className="py-2.5 px-3">Trigger Type</th>
                  <th className="py-2.5 px-3">Records Included</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => {
                  const dateStr = b.created_at
                    ? new Date(b.created_at).toLocaleString("en-IN")
                    : "N/A";
                  const summary = b.record_counts
                    ? `${b.record_counts.students || 0} students, ${b.record_counts.teachers || 0} teachers, ${b.record_counts.batches || 0} batches`
                    : "Full Database";

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            b.backup_type === "manual_export"
                              ? "info"
                              : b.backup_type === "pre_purge_snapshot"
                              ? "danger"
                              : b.backup_type === "pre_restore_snapshot"
                              ? "warning"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {b.backup_type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{summary}</td>
                      <td className="py-2.5 px-3 text-slate-400 italic">
                        {b.notes || "Automated snapshot"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadHistoricalSnapshot(b.id)}
                          className="text-[11px] py-1 px-2 border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          <Download size={12} className="mr-1" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 5: Clean-Slate Demo Data Purge (Owner / Super Admin Only) */}
      {isOwnerOrSuper && (
        <div className="bg-rose-50/70 rounded-2xl border-2 border-rose-200 p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3 border-b border-rose-200 pb-4">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-rose-900 font-['Manrope']">
                  Clean Handover: Purge Demo Data & Reset to Clean Slate
                </h3>
                <Badge variant="danger" size="sm">
                  Owner Only
                </Badge>
              </div>
              <p className="text-xs text-rose-800/90 mt-1 leading-relaxed">
                Prepare the system for real Pradeep Classes operations. This operation clears sample demo records while <strong>strictly preserving</strong> your institute profile, administrator login accounts, WhatsApp templates, and academic settings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200 space-y-2">
              <span className="font-bold text-rose-900 block flex items-center gap-1.5">
                <Trash2 size={14} className="text-rose-600" />
                Data That Will Be Purged:
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>Sample faculty (Dr. Rajesh Sharma, Er. Manoj Deshmukh, Prof. Sunita Patil)</li>
                <li>Sample students (Aarav Patel, Sneha Gupta, Rohan Verma, etc.)</li>
                <li>Sample batches (JEE Advanced 2026, NEET Medical 2026)</li>
                <li>Sample attendance logs, exam marksheets, and fee invoices</li>
                <li>Sample teacher payroll disbursements and expense ledger rows</li>
              </ul>
            </div>

            <div className="bg-white/80 p-3.5 rounded-xl border border-emerald-200 space-y-2">
              <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Data Strictly Preserved:
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>Institute profile, address, contact numbers & branding</li>
                <li>Administrator & Owner logins and passwords</li>
                <li>WhatsApp Cloud API configurations & message templates</li>
                <li>Curriculum standard structures & academic year defaults</li>
                <li>Automatic pre-purge recovery snapshot for rollback safety</li>
              </ul>
            </div>
          </div>

          {purgeResult ? (
            <div className="p-4 bg-emerald-100/90 border border-emerald-300 rounded-xl text-emerald-950 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-700" />
                <span>Demo Data Successfully Purged! Clean Slate Ready.</span>
              </div>
              <p className="text-[11px]">
                Purged {purgeResult.purgedCounts?.students || 0} students, {purgeResult.purgedCounts?.teachers || 0} teachers, and {purgeResult.purgedCounts?.batches || 0} batches. Pre-purge rollback snapshot: <span className="font-mono font-bold">{purgeResult.snapshotId}</span>.
              </p>
              <div className="pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                >
                  Reload Workspace
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-3">
              <p className="text-xs text-rose-900 font-semibold">
                To confirm demo data purge, type <strong>PURGE DEMO DATA</strong> below:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder="PURGE DEMO DATA"
                  className="text-xs flex-1 border-rose-300 focus:ring-rose-400"
                />
                <Button
                  variant="primary"
                  onClick={handlePurgeDemoData}
                  isLoading={isPurging}
                  disabled={purgeConfirmText.trim() !== "PURGE DEMO DATA"}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs shrink-0"
                  icon={<Trash2 size={14} />}
                >
                  Purge Demo Data
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
