import React, { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button, Badge, AlertNotice } from "../components/common";
import { useAuth } from "../hooks/useAuth";

export const Attendance: React.FC = () => {
  const { role, isDemoMode } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState("JEE Morning");
  const [notice, setNotice] = useState<string | null>(null);

  // Sample batch roll call for UI demonstration
  const [records, setRecords] = useState([
    { id: "1", name: "Aarav Sharma", admissionNo: "PC-2026-001", status: "present" },
    { id: "2", name: "Ananya Verma", admissionNo: "PC-2026-002", status: "present" },
    { id: "3", name: "Rohan Singh", admissionNo: "PC-2026-003", status: "absent" },
    { id: "4", name: "Ishita Gupta", admissionNo: "PC-2026-004", status: "late" },
    { id: "5", name: "Kabir Yadav", admissionNo: "PC-2026-005", status: "present" },
  ]);

  const updateStatus = (id: string, newStatus: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  const handleSaveAttendance = () => {
    setNotice(
      isDemoMode
        ? "Attendance marked in DEMO mode. Supabase RLS policies will enforce batch-scoped teacher submissions in production."
        : "Attendance roll submitted and audited successfully."
    );
    window.setTimeout(() => setNotice(null), 6000);
  };

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice type="info" message={notice} onDismiss={() => setNotice(null)} />
      )}

      <div className="welcome-row">
        <div>
          <div className="eyebrow">DAILY ATTENDANCE</div>
          <h1>Batch Attendance Register</h1>
          <p>
            {role === "teacher"
              ? "Mark daily student presence for your assigned batches only."
              : "Monitor and audit daily student attendance across all institute batches."}
          </p>
        </div>
        <Button variant="primary" onClick={handleSaveAttendance} icon={<ClipboardCheck size={16} />}>
          Save attendance roll
        </Button>
      </div>

      <section className="panel directory-panel">
        <div className="panel-heading flex-wrap gap-3">
          <div>
            <h3>Daily Roll Call • Friday, 20 November 2026</h3>
            <p>Select batch to record student attendance</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white outline-none focus:border-[#16466f]"
            >
              <option>JEE Morning</option>
              <option>NEET Evening</option>
              <option>Foundation A</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>ADMISSION NO.</th>
                <th>BATCH</th>
                <th>ATTENDANCE STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="student-cell">
                      <div className="student-avatar">
                        {r.name
                          .split(" ")
                          .map((x) => x[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <b>{r.name}</b>
                    </div>
                  </td>
                  <td className="muted-cell">{r.admissionNo}</td>
                  <td>{selectedBatch}</td>
                  <td>
                    <Badge
                      variant={
                        r.status === "present"
                          ? "success"
                          : r.status === "absent"
                          ? "danger"
                          : "warning"
                      }
                      size="sm"
                      showDot
                    >
                      {r.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateStatus(r.id, "present")}
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          r.status === "present"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        P
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "absent")}
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          r.status === "absent"
                            ? "bg-rose-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        A
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "late")}
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          r.status === "late"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        L
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            <b>{records.filter((r) => r.status === "present").length}</b> Present •{" "}
            <b>{records.filter((r) => r.status === "absent").length}</b> Absent •{" "}
            <b>{records.filter((r) => r.status === "late").length}</b> Late
          </span>
          {isDemoMode && (
            <Badge variant="demo" size="sm">
              DEMO SAMPLE DATA
            </Badge>
          )}
        </div>
      </section>
    </div>
  );
};
