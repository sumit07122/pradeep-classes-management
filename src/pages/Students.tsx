import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Download,
  MoreHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { studentsService } from "../services/studentsService";
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  EmptyState,
  LoadingSpinner,
  AlertNotice,
} from "../components/common";
import { useAuth } from "../hooks/useAuth";
import type { Student } from "../types";

export const Students: React.FC = () => {
  const { isDemoMode } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // New student form state
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("Class 12");
  const [batchName, setBatchName] = useState("JEE Morning");
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableBatches = studentsService.getAvailableBatches();

  const loadStudents = async () => {
    setLoading(true);
    const res = await studentsService.getStudents();
    setStudents(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesQuery = `${s.full_name} ${s.admission_no} ${s.batch_name} ${s.class_name} ${s.phone}`
        .toLowerCase()
        .includes(query.toLowerCase());

      const matchesBatch = selectedBatch === "All" || s.batch_name === selectedBatch;
      return matchesQuery && matchesBatch;
    });
  }, [students, query, selectedBatch]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setIsSubmitting(true);
    const res = await studentsService.createStudent({
      full_name: fullName.trim(),
      class_name: className,
      batch_name: batchName,
      phone: phone.trim(),
      parent_name: parentName.trim() || undefined,
      parent_phone: parentPhone.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setNotice({ message: res.error || "Failed to save student.", type: "error" });
      return;
    }

    setStudents((prev) => [res.data!, ...prev]);
    setShowAddModal(false);
    // Reset form
    setFullName("");
    setPhone("");
    setParentName("");
    setParentPhone("");

    setNotice({
      message: isDemoMode
        ? "Student added in DEMO mode (in-memory). Configure Supabase to persist live student records."
        : `Student ${res.data.full_name} saved successfully with Admission ID ${res.data.admission_no}.`,
      type: "success",
    });

    window.setTimeout(() => setNotice(null), 6000);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Notice */}
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
          <p>Manage student profiles, admissions, batch allocations and records.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          icon={<Plus size={16} />}
        >
          Add new student
        </Button>
      </div>

      {/* Directory Panel */}
      <section className="panel directory-panel">
        {/* Toolbar */}
        <div className="directory-toolbar flex-wrap gap-3">
          <div className="search-box min-w-[280px]">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student name, admission no., or mobile..."
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white outline-none focus:border-[#16466f]"
            >
              <option value="All">All Batches</option>
              {availableBatches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => alert("Export feature will be available in milestone 2.")}
            >
              Export
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSpinner label="Loading student directory..." />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="No students match criteria"
            description={
              query
                ? `No students found matching "${query}". Try adjusting your search keyword or batch filter.`
                : "No students are currently enrolled in Pradeep Classes. Click Add Student to register a new admission."
            }
            actionLabel="Add new student"
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
                  {isDemoMode && <th>MODE</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar">
                          {s.full_name
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <b>{s.full_name}</b>
                          {s.parent_name && (
                            <small className="block text-[10px] text-slate-400">
                              P: {s.parent_name}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="muted-cell font-mono text-[11px]">{s.admission_no}</td>
                    <td>{s.class_name}</td>
                    <td>
                      <span className="font-semibold text-slate-700">{s.batch_name}</span>
                    </td>
                    <td>{s.phone}</td>
                    <td>
                      <Badge
                        variant={s.status === "Active" ? "success" : "warning"}
                        size="sm"
                        showDot
                      >
                        {s.status}
                      </Badge>
                    </td>
                    {isDemoMode && (
                      <td>
                        <Badge variant="demo" size="sm">
                          DEMO
                        </Badge>
                      </td>
                    )}
                    <td>
                      <button className="more-button" aria-label="Student actions">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <span>
            Showing <b>{filteredStudents.length}</b> of <b>{students.length}</b> student records
          </span>
          <span>Page 1 of 1</span>
        </div>
      </section>

      {/* Add Student Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New Student"
        subtitle="STUDENT ADMISSION"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <Input
            label="Student Full Name"
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Aarav Sharma"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Course / Class"
              options={["Class 10", "Class 11", "Class 12", "JEE Foundation", "NEET Medical"]}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />

            <Select
              label="Assigned Batch"
              options={availableBatches}
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
          </div>

          <Input
            label="Student Mobile Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            maxLength={10}
          />

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <Input
              label="Parent / Guardian Name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
            />
            <Input
              label="Parent Mobile"
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="Emergency contact"
              maxLength={10}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              icon={<ArrowUpRight size={15} />}
            >
              Save student record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
