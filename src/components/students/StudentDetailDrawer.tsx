import React, { useState, useEffect } from "react";
import {
  X,
  Phone,
  Mail,
  MapPin,
  Users,
  BookOpen,
  ArrowRightLeft,
  Edit2,
  Clock,
  Shield,
  FileText,
} from "lucide-react";
import { Badge, Button, LoadingSpinner } from "../common";
import { studentsService } from "../../services/studentsService";
import type { Student, StudentBatchHistory } from "../../types";

interface StudentDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onEdit: (student: Student) => void;
  onTransfer: (student: Student) => void;
  onArchived: () => void;
}

export const StudentDetailDrawer: React.FC<StudentDetailDrawerProps> = ({
  isOpen,
  onClose,
  student,
  onEdit,
  onTransfer,
  onArchived,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");
  const [history, setHistory] = useState<StudentBatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    if (student && isOpen) {
      loadHistory();
    }
  }, [student, isOpen]);

  const loadHistory = async () => {
    if (!student) return;
    setLoadingHistory(true);
    const res = await studentsService.getStudentBatchHistory(student.id);
    setHistory(res.data);
    setLoadingHistory(false);
  };

  if (!isOpen || !student) return null;

  const handleArchive = async () => {
    if (!confirm(`Are you sure you want to archive student ${student.full_name}?`)) {
      return;
    }
    setIsArchiving(true);
    const res = await studentsService.archiveStudent(student.id);
    setIsArchiving(false);
    if (res.success) {
      onArchived();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#16466f] text-white flex items-center justify-center font-bold text-lg shadow-md">
                {student.full_name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-slate-800">{student.full_name}</h2>
                  <Badge
                    variant={
                      student.status === "Active"
                        ? "success"
                        : student.status === "On hold"
                        ? "warning"
                        : "neutral"
                    }
                    size="sm"
                    showDot
                  >
                    {student.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>ID: {student.admission_no}</span>
                  <span>•</span>
                  <span>{student.class_name}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Action Bar */}
          <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowRightLeft size={13} />}
                onClick={() => onTransfer(student)}
              >
                Transfer Batch
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit2 size={13} />}
                onClick={() => onEdit(student)}
              >
                Edit Details
              </Button>
            </div>

            {student.status === "Active" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleArchive}
                disabled={isArchiving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
              >
                Archive Student
              </Button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 pt-3 border-b border-slate-100 flex gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-2.5 transition-all ${
                activeTab === "profile"
                  ? "text-[#16466f] border-b-2 border-[#16466f]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Overview & Guardian
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 transition-all flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "text-[#16466f] border-b-2 border-[#16466f]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Batch Transfer History</span>
              {history.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.2 rounded-full">
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {activeTab === "profile" ? (
              <>
                {/* Academic Allocation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} className="text-[#16466f]" />
                    Academic Allocation
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Enrolled Batch:</span>
                      <span className="font-bold text-[#16466f] bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                        {student.batch_name || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Class:</span>
                      <span className="font-semibold text-slate-800">{student.class_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Admission Date:</span>
                      <span className="font-medium text-slate-700">
                        {student.joined_on || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Admission ID:</span>
                      <span className="font-mono font-bold text-slate-700">
                        {student.admission_no}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact & Personal */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-[#16466f]" />
                    Contact & Personal Information
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-100 rounded-lg">
                      <Phone size={14} className="text-slate-400" />
                      <div>
                        <span className="text-slate-400 text-[10px] block">Student Mobile</span>
                        <span className="font-semibold text-slate-800">{student.phone}</span>
                      </div>
                    </div>

                    {student.email && (
                      <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-100 rounded-lg">
                        <Mail size={14} className="text-slate-400" />
                        <div>
                          <span className="text-slate-400 text-[10px] block">Email Address</span>
                          <span className="font-semibold text-slate-800">{student.email}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-white border border-slate-100 rounded-lg">
                        <span className="text-slate-400 text-[10px] block">Date of Birth</span>
                        <span className="font-semibold text-slate-800">
                          {student.date_of_birth || "Not specified"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-100 rounded-lg">
                        <span className="text-slate-400 text-[10px] block">Gender</span>
                        <span className="font-semibold text-slate-800 capitalize">
                          {student.gender || "Not specified"}
                        </span>
                      </div>
                    </div>

                    {student.address && (
                      <div className="flex items-start gap-3 p-2.5 bg-white border border-slate-100 rounded-lg">
                        <MapPin size={14} className="text-slate-400 mt-0.5" />
                        <div>
                          <span className="text-slate-400 text-[10px] block">Address</span>
                          <span className="font-semibold text-slate-800">
                            {student.address}, {student.city || "Kota"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parent / Guardian Information */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-[#16466f]" />
                    Parent / Guardian Information
                  </h3>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guardian Name:</span>
                      <span className="font-bold text-slate-800">
                        {student.parent_name || "Not recorded"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Relationship:</span>
                      <span className="font-medium text-slate-700">
                        {student.parent_relation || "Parent"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guardian Mobile:</span>
                      <span className="font-semibold text-slate-800">
                        {student.parent_phone || "Not recorded"}
                      </span>
                    </div>
                    {student.parent_email && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Guardian Email:</span>
                        <span className="font-medium text-slate-700">{student.parent_email}</span>
                      </div>
                    )}
                    {student.emergency_contact && (
                      <div className="flex justify-between pt-1 border-t border-slate-200 text-amber-700 font-semibold">
                        <span>Emergency Contact:</span>
                        <span>{student.emergency_contact}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {student.notes && (
                  <div className="space-y-1 text-xs">
                    <span className="text-slate-400 uppercase font-bold text-[10px] flex items-center gap-1">
                      <FileText size={12} /> Notes & Remarks
                    </span>
                    <p className="bg-white p-3 rounded-lg border border-slate-100 text-slate-600 italic">
                      "{student.notes}"
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* Tab 2: Batch Transfer History */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Allocation & Transfer Audit Trail
                  </h3>
                  <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loadingHistory}>
                    Refresh
                  </Button>
                </div>

                {loadingHistory ? (
                  <LoadingSpinner label="Loading history..." />
                ) : history.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                    <Clock size={24} className="mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No batch transfers on record</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      This student has remained in their initial assigned batch since enrollment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                    {history.map((item) => (
                      <div key={item.id} className="relative flex items-start gap-4 pl-8">
                        <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full bg-[#16466f] border-2 border-white shadow-sm" />
                        <div className="flex-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span>
                              {new Date(item.transfer_date).toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1.5">
                            <span className="line-through text-slate-400">
                              {item.from_batch_name}
                            </span>
                            <span className="text-[#16466f]">➔</span>
                            <span className="text-emerald-700 font-bold">
                              {item.to_batch_name}
                            </span>
                          </div>
                          {item.reason && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                              Reason: {item.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
