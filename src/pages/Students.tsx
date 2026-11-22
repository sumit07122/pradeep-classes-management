import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Download,
  ArrowRightLeft,
  Edit2,
  Eye,
  Archive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { studentsService, type LiveBatchOption } from "../services/studentsService";
import {
  Button,
  Badge,
  EmptyState,
  LoadingSpinner,
  AlertNotice,
} from "../components/common";
import { AdmissionModal } from "../components/students/AdmissionModal";
import { StudentDetailDrawer } from "../components/students/StudentDetailDrawer";
import { BatchTransferModal } from "../components/students/BatchTransferModal";
import { StudentEditModal } from "../components/students/StudentEditModal";
import { exportStudentsToCSV } from "../utils/csvExport";
import type { Student, StudentStatus } from "../types";

const CLASSES = ["All", "Class 12", "Class 11", "Class 10", "Class 9", "Dropper / Repeaters"];
const STATUSES = ["All", "Active", "On hold", "Inactive"] as const;

export const Students: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters & Search
  const [query, setQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("All");
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<StudentStatus | "All">("All");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Batches for filter
  const [batches, setBatches] = useState<LiveBatchOption[]>([]);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<Student | null>(null);
  const [selectedStudentForTransfer, setSelectedStudentForTransfer] = useState<Student | null>(null);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);

  // Load batches on mount
  useEffect(() => {
    async function fetchBatches() {
      const list = await studentsService.getLiveBatches();
      setBatches(list);
    }
    fetchBatches();
  }, []);

  // Load students on filters/page change
  const loadStudents = async () => {
    setLoading(true);
    const res = await studentsService.getStudents({
      query,
      batchId: selectedBatchId,
      className: selectedClass,
      status: selectedStatus,
      page,
      pageSize,
    });

    setStudents(res.data);
    setTotalCount(res.totalCount);
    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
  }, [query, selectedBatchId, selectedClass, selectedStatus, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleStudentAdded = (
    newStudent: Student,
    options?: { credentialsProvisioned?: boolean }
  ) => {
    const credsText = options?.credentialsProvisioned
      ? " Portal login credentials created and ready for dispatch."
      : "";
    setNotice({
      message: `Student ${newStudent.full_name} enrolled successfully with Admission ID ${newStudent.admission_no}.${credsText}`,
      type: "success",
    });
    setPage(1);
    loadStudents();
  };

  const handleStudentUpdated = (updated: Student) => {
    setNotice({
      message: `Student ${updated.full_name} updated successfully.`,
      type: "success",
    });
    if (selectedStudentForDrawer?.id === updated.id) {
      setSelectedStudentForDrawer(updated);
    }
    loadStudents();
  };

  const handleTransferSuccess = () => {
    setNotice({
      message: "Batch transfer completed and recorded in audit history.",
      type: "success",
    });
    loadStudents();
  };

  const handleArchiveStudent = async (student: Student) => {
    if (!confirm(`Are you sure you want to deactivate student ${student.full_name}?`)) {
      return;
    }

    const res = await studentsService.archiveStudent(student.id);
    if (!res.success) {
      setNotice({ message: res.error || "Failed to archive student.", type: "error" });
    } else {
      setNotice({ message: `Student ${student.full_name} deactivated.`, type: "success" });
      loadStudents();
    }
  };

  const handleExport = () => {
    exportStudentsToCSV(students);
  };

  return (
    <div className="space-y-5">
      {/* Notice Banner */}
      {notice && (
        <AlertNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">STUDENT DIRECTORY</div>
          <h1>Student Management</h1>
          <p>
            Manage student admissions, batch allocations, academic details, and transfer histories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExport}
            icon={<Download size={15} />}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowAddModal(true)}
            icon={<Plus size={16} />}
          >
            New Admission
          </Button>
        </div>
      </div>

      {/* Directory Filter Toolbar */}
      <section className="panel directory-panel p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="search-box flex-1 min-w-[280px]">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by student name, admission ID, mobile, or guardian..."
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Batch Filter */}
            <select
              value={selectedBatchId}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white outline-none focus:border-[#16466f]"
            >
              <option value="All">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Class Filter */}
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white outline-none focus:border-[#16466f]"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Classes" : c}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white outline-none focus:border-[#16466f]"
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === "All" ? "All Statuses" : st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <LoadingSpinner label="Loading student records from Supabase..." />
        ) : students.length === 0 ? (
          <EmptyState
            title="No students match criteria"
            description={
              query || selectedBatchId !== "All" || selectedClass !== "All" || selectedStatus !== "All"
                ? "No student records found matching the applied search filters. Try adjusting keywords or filters."
                : "No students are currently enrolled. Click New Admission to register a student."
            }
            actionLabel="New Admission"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>ADMISSION ID</th>
                  <th>CLASS</th>
                  <th>ASSIGNED BATCH</th>
                  <th>MOBILE NO.</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td>
                      <div
                        className="student-cell cursor-pointer"
                        onClick={() => setSelectedStudentForDrawer(s)}
                      >
                        <div className="student-avatar">
                          {s.full_name
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <b className="hover:text-[#16466f] transition-colors">{s.full_name}</b>
                          {s.parent_name && (
                            <small className="block text-[10px] text-slate-400">
                              Guardian: {s.parent_name}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="font-mono text-xs font-semibold text-slate-700">
                      {s.admission_no}
                    </td>

                    <td className="text-xs text-slate-600 font-medium">{s.class_name}</td>

                    <td>
                      <span className="font-bold text-xs text-[#16466f] bg-[#16466f]/10 px-2 py-0.5 rounded">
                        {s.batch_name || "Unassigned"}
                      </span>
                    </td>

                    <td className="text-xs text-slate-600">{s.phone}</td>

                    <td>
                      <Badge
                        variant={
                          s.status === "Active"
                            ? "success"
                            : s.status === "On hold"
                            ? "warning"
                            : "neutral"
                        }
                        size="sm"
                        showDot
                      >
                        {s.status}
                      </Badge>
                    </td>

                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedStudentForDrawer(s)}
                          className="p-1.5 text-slate-400 hover:text-[#16466f] hover:bg-slate-100 rounded-md transition-colors"
                          title="View Profile"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setSelectedStudentForTransfer(s)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                          title="Transfer Batch"
                        >
                          <ArrowRightLeft size={15} />
                        </button>
                        <button
                          onClick={() => setSelectedStudentForEdit(s)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit Student"
                        >
                          <Edit2 size={15} />
                        </button>
                        {s.status === "Active" && (
                          <button
                            onClick={() => handleArchiveStudent(s)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Deactivate Student"
                          >
                            <Archive size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, totalCount)} of {totalCount} students
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft size={14} />}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronRight size={14} />}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {/* New Admission Modal */}
      <AdmissionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleStudentAdded}
      />

      {/* Student Detail Drawer */}
      <StudentDetailDrawer
        isOpen={Boolean(selectedStudentForDrawer)}
        onClose={() => setSelectedStudentForDrawer(null)}
        student={selectedStudentForDrawer}
        onEdit={(st) => setSelectedStudentForEdit(st)}
        onTransfer={(st) => setSelectedStudentForTransfer(st)}
        onArchived={loadStudents}
      />

      {/* Batch Transfer Modal */}
      <BatchTransferModal
        isOpen={Boolean(selectedStudentForTransfer)}
        onClose={() => setSelectedStudentForTransfer(null)}
        student={selectedStudentForTransfer}
        onSuccess={handleTransferSuccess}
      />

      {/* Student Edit Modal */}
      <StudentEditModal
        isOpen={Boolean(selectedStudentForEdit)}
        onClose={() => setSelectedStudentForEdit(null)}
        student={selectedStudentForEdit}
        onSuccess={handleStudentUpdated}
      />
    </div>
  );
};
