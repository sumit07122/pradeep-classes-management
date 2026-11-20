import React, { useState, useEffect } from "react";
import { X, Clock, MapPin, ArrowRightLeft } from "lucide-react";
import { batchesService } from "../../services/batchesService";
import { Badge, LoadingSpinner, EmptyState, Button } from "../common";
import type { Batch, Student } from "../../types";

interface BatchRosterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  batch: Batch | null;
  onTransferStudent?: (student: Student) => void;
  onViewStudent?: (student: Student) => void;
}

export const BatchRosterDrawer: React.FC<BatchRosterDrawerProps> = ({
  isOpen,
  onClose,
  batch,
  onTransferStudent,
  onViewStudent,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && batch) {
      loadRoster();
    }
  }, [isOpen, batch]);

  const loadRoster = async () => {
    if (!batch) return;
    setLoading(true);
    const res = await batchesService.getBatchRoster(batch.id);
    setStudents(res.data);
    setLoading(false);
  };

  if (!isOpen || !batch) return null;

  const enrolledCount = students.length;
  const maxCap = batch.max_capacity || 40;
  const capacityPct = Math.min(100, Math.round((enrolledCount / maxCap) * 100));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#16466f] bg-[#16466f]/10 px-2 py-0.5 rounded">
                  {batch.course_name}
                </span>
                <Badge
                  variant={batch.status === "active" ? "success" : "neutral"}
                  size="sm"
                  showDot
                >
                  {batch.status.toUpperCase()}
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-slate-800">{batch.name}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                {batch.timing && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-slate-400" />
                    {batch.timing}
                  </span>
                )}
                {batch.room_number && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-slate-400" />
                    {batch.room_number}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              aria-label="Close roster"
            >
              <X size={18} />
            </button>
          </div>

          {/* Capacity Progress Bar */}
          <div className="px-5 py-3 bg-white border-b border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span>Classroom Capacity</span>
              <span className="font-mono text-slate-600">
                {enrolledCount} / {maxCap} Seats ({capacityPct}%)
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

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <LoadingSpinner label="Loading batch roster..." />
            ) : students.length === 0 ? (
              <EmptyState
                title="No students enrolled"
                description="This batch does not currently have any active students. You can assign students from the Student Directory."
              />
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Enrolled Students ({students.length})
                </div>
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#16466f] text-white flex items-center justify-center font-bold text-xs">
                        {student.full_name
                          .split(" ")
                          .map((x) => x[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <div
                          className="font-bold text-xs text-slate-800 hover:text-[#16466f] cursor-pointer"
                          onClick={() => onViewStudent && onViewStudent(student)}
                        >
                          {student.full_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                          <span>{student.admission_no}</span>
                          <span>•</span>
                          <span>{student.phone || "No phone"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={student.status === "Active" ? "success" : "neutral"}
                        size="sm"
                      >
                        {student.status}
                      </Badge>
                      {onTransferStudent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowRightLeft size={13} />}
                          onClick={() => onTransferStudent(student)}
                          title="Transfer to another batch"
                        >
                          Transfer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close Roster
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
