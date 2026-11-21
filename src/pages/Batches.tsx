import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Clock,
  MapPin,
  Users,
  UserPlus,
  Edit2,
  Archive,
  Search,
} from "lucide-react";
import { batchesService } from "../services/batchesService";
import {
  Button,
  Badge,
  EmptyState,
  LoadingSpinner,
  AlertNotice,
} from "../components/common";
import { BatchModal } from "../components/batches/BatchModal";
import { TeacherAssignModal } from "../components/batches/TeacherAssignModal";
import { BatchRosterDrawer } from "../components/batches/BatchRosterDrawer";
import type { Batch, BatchStatus } from "../types";

export const Batches: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BatchStatus | "all">("all");

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [assigningFacultyBatch, setAssigningFacultyBatch] = useState<Batch | null>(null);
  const [rosterBatch, setRosterBatch] = useState<Batch | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    const res = await batchesService.getBatches();
    setBatches(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.room_number && b.room_number.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [batches, searchQuery, statusFilter]);

  const handleCreateBatch = async (batchData: Partial<Batch>): Promise<boolean> => {
    const res = await batchesService.createBatch(batchData as any);
    if (res.error || !res.data) {
      setNotice({ message: res.error || "Could not create batch.", type: "error" });
      return false;
    }

    setNotice({
      message: `Batch "${res.data.name}" created successfully.`,
      type: "success",
    });
    setShowCreateModal(false);
    await loadBatches();
    return true;
  };

  const handleUpdateBatch = async (batchData: Partial<Batch>): Promise<boolean> => {
    if (!editingBatch) return false;
    const res = await batchesService.updateBatch(editingBatch.id, batchData);
    if (res.error || !res.data) {
      setNotice({ message: res.error || "Could not update batch.", type: "error" });
      return false;
    }

    setNotice({
      message: `Batch "${res.data.name}" updated successfully.`,
      type: "success",
    });
    setEditingBatch(null);
    await loadBatches();
    return true;
  };

  const handleArchiveBatch = async (batch: Batch) => {
    if (!confirm(`Are you sure you want to archive batch "${batch.name}"? Active students will need to be reallocated.`)) {
      return;
    }

    const res = await batchesService.archiveBatch(batch.id);
    if (!res.success) {
      setNotice({ message: res.error || "Failed to archive batch.", type: "error" });
    } else {
      setNotice({ message: `Batch "${batch.name}" archived.`, type: "success" });
      await loadBatches();
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Page Header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">ACADEMIC GROUPS</div>
          <h1>Courses & Batches</h1>
          <p>Organize students, curriculum pacing, classroom capacity, and faculty assignments.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          icon={<Plus size={16} />}
        >
          Create batch
        </Button>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="search-box flex-1 min-w-[260px]">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search batches by name, course, or classroom..."
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["all", "active", "completed", "archived"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st
                  ? "bg-[#16466f] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Grid */}
      <section>
        {loading ? (
          <LoadingSpinner label="Loading course batches & capacity..." />
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            title="No batches match criteria"
            description={
              searchQuery || statusFilter !== "all"
                ? "No batches found matching the selected search or status filters."
                : "Create your first learning batch to start enrolling students and assigning faculty."
            }
            actionLabel="Create batch"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBatches.map((b) => {
              const enrolled = b.student_count || 0;
              const maxCap = b.max_capacity || 40;
              const capacityPct = Math.min(100, Math.round((enrolled / maxCap) * 100));

              return (
                <div
                  key={b.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#16466f] bg-[#16466f]/10 px-2 py-0.5 rounded">
                          {b.course_name}
                        </span>
                        <Badge
                          variant={
                            b.status === "active"
                              ? "success"
                              : b.status === "completed"
                              ? "info"
                              : "neutral"
                          }
                          size="sm"
                          showDot
                        >
                          {b.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingBatch(b)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                          title="Edit batch"
                        >
                          <Edit2 size={14} />
                        </button>
                        {b.status === "active" && (
                          <button
                            onClick={() => handleArchiveBatch(b)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Archive batch"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Batch Name & Academic Year */}
                    <h3 className="text-base font-bold text-slate-800 mb-1">{b.name}</h3>
                    <p className="text-xs text-slate-400 font-medium mb-3">
                      Academic Year: {b.academic_year || "2026-2027"}
                    </p>

                    {/* Timing & Room */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-slate-400" />
                        {b.timing || "Timing TBD"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-400" />
                        {b.room_number || "Room TBD"}
                      </span>
                    </div>

                    {/* Capacity Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Enrollment Capacity</span>
                        <span className="font-mono text-slate-600">
                          {enrolled} / {maxCap} Seats ({capacityPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            capacityPct >= 95
                              ? "bg-red-500"
                              : capacityPct >= 80
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${capacityPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Assigned Faculty */}
                    <div className="mb-4">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Assigned Faculty</span>
                        <button
                          onClick={() => setAssigningFacultyBatch(b)}
                          className="text-[#16466f] hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <UserPlus size={11} /> Manage
                        </button>
                      </div>

                      {b.assigned_teachers && b.assigned_teachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {b.assigned_teachers.map((t: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          No faculty assigned yet
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Users size={14} />}
                      onClick={() => setRosterBatch(b)}
                    >
                      Enrolled Roster ({enrolled})
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 size={13} />}
                      onClick={() => setEditingBatch(b)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create Batch Modal */}
      <BatchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateBatch}
      />

      {/* Edit Batch Modal */}
      <BatchModal
        isOpen={Boolean(editingBatch)}
        onClose={() => setEditingBatch(null)}
        onSave={handleUpdateBatch}
        initialData={editingBatch}
      />

      {/* Teacher Assignment Modal */}
      <TeacherAssignModal
        isOpen={Boolean(assigningFacultyBatch)}
        onClose={() => setAssigningFacultyBatch(null)}
        batch={assigningFacultyBatch}
        onUpdated={loadBatches}
      />

      {/* Batch Roster Drawer */}
      <BatchRosterDrawer
        isOpen={Boolean(rosterBatch)}
        onClose={() => setRosterBatch(null)}
        batch={rosterBatch}
      />
    </div>
  );
};
