import React, { useState, useEffect } from "react";
import { Modal, Button } from "../common";
import { teachersService } from "../../services/teachersService";
import { batchesService } from "../../services/batchesService";
import { UserPlus, Trash2, GraduationCap } from "lucide-react";
import type { Batch, Teacher } from "../../types";

interface TeacherAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: Batch | null;
  onUpdated: () => void;
}

export const TeacherAssignModal: React.FC<TeacherAssignModalProps> = ({
  isOpen,
  onClose,
  batch,
  onUpdated,
}) => {
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (isOpen && batch) {
      loadTeachers();
    }
  }, [isOpen, batch]);

  const loadTeachers = async () => {
    const res = await teachersService.getTeachers();
    setAllTeachers(res.data);
  };

  if (!batch) return null;

  const currentTeacherAssignments = batch.teacher_assignments || [];
  const assignedTeacherIds = new Set(currentTeacherAssignments.map((t) => t.id));
  const availableTeachers = allTeachers.filter((t) => !assignedTeacherIds.has(t.id));

  const handleAssign = async () => {
    if (!selectedTeacherId) return;
    setIsSubmitting(true);
    setNotice(null);

    const res = await batchesService.assignTeacher(batch.id, selectedTeacherId);
    setIsSubmitting(false);

    if (res.error) {
      setNotice({ message: res.error, type: "error" });
    } else {
      setNotice({ message: "Teacher assigned successfully.", type: "success" });
      setSelectedTeacherId("");
      onUpdated();
    }
  };

  const handleRemove = async (teacherId: string) => {
    setIsSubmitting(true);
    setNotice(null);

    const res = await batchesService.removeTeacher(batch.id, teacherId);
    setIsSubmitting(false);

    if (res.error) {
      setNotice({ message: res.error, type: "error" });
    } else {
      setNotice({ message: "Teacher removed from batch.", type: "success" });
      onUpdated();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Faculty Allocation: ${batch.name}`}
      subtitle="TEACHER-BATCH ASSIGNMENT"
    >
      <div className="space-y-4">
        {notice && (
          <div
            className={`p-3 rounded-lg text-xs ${
              notice.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {notice.message}
          </div>
        )}

        {/* Currently assigned teachers */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Assigned Teachers ({currentTeacherAssignments.length})
          </h4>

          {currentTeacherAssignments.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
              No faculty currently allocated to this batch.
            </p>
          ) : (
            <div className="space-y-2">
              {currentTeacherAssignments.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#16466f]/10 text-[#16466f] flex items-center justify-center font-bold text-xs">
                      <GraduationCap size={15} />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-slate-800">{t.full_name}</div>
                      <div className="text-[10px] text-slate-400">{t.subject}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(t.id)}
                    disabled={isSubmitting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign new teacher */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Assign Another Teacher
          </h4>

          {availableTeachers.length === 0 ? (
            <p className="text-xs text-slate-400">
              All active teachers are already assigned to this batch.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
              >
                <option value="">Select a teacher...</option>
                {availableTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.subject})
                  </option>
                ))}
              </select>

              <Button
                variant="primary"
                size="sm"
                onClick={handleAssign}
                disabled={!selectedTeacherId || isSubmitting}
                isLoading={isSubmitting}
                icon={<UserPlus size={14} />}
              >
                Assign
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
