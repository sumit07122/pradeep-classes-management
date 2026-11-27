import React, { useState, useEffect } from "react";
import { X, Plus, Edit2, Trash2, Check, AlertCircle, Layers } from "lucide-react";
import { Button, Input, LoadingSpinner, Badge } from "../common";
import { feesService } from "../../services/feesService";
import type { FeeStructure } from "../../types/fees";

interface FeeStructuresModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStructuresUpdated?: () => void;
}

export const FeeStructuresModal: React.FC<FeeStructuresModalProps> = ({
  isOpen,
  onClose,
  onStructuresUpdated,
}) => {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form state (Add / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [totalFee, setTotalFee] = useState<number | "">("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadStructures();
      resetForm();
    }
  }, [isOpen]);

  const loadStructures = async () => {
    setIsLoading(true);
    try {
      const data = await feesService.getFeeStructures();
      setStructures(data);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load fee structures");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setCourseName("");
    setAcademicYear("2025-2026");
    setTotalFee("");
    setDescription("");
    setErrorNotice(null);
  };

  const handleStartEdit = (fs: FeeStructure) => {
    setEditingId(fs.id);
    setCourseName(fs.course_name);
    setAcademicYear(fs.academic_year);
    setTotalFee(fs.total_fee);
    setDescription(fs.description || "");
    setIsFormOpen(true);
    setErrorNotice(null);
    setSuccessNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) {
      setErrorNotice("Course / Batch name is required.");
      return;
    }
    if (!totalFee || Number(totalFee) <= 0) {
      setErrorNotice("Please enter a valid total fee greater than 0.");
      return;
    }

    setIsSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      if (editingId) {
        const res = await feesService.updateFeeStructure(editingId, {
          course_name: courseName.trim(),
          academic_year: academicYear.trim(),
          total_fee: Number(totalFee),
          description: description.trim(),
        });
        if (res.error) throw new Error(res.error);
        setSuccessNotice(`Fee structure for "${courseName}" updated successfully.`);
      } else {
        const res = await feesService.createFeeStructure({
          course_name: courseName.trim(),
          academic_year: academicYear.trim(),
          total_fee: Number(totalFee),
          description: description.trim(),
        });
        if (res.error) throw new Error(res.error);
        setSuccessNotice(`New fee plan for "${courseName}" created successfully.`);
      }

      resetForm();
      await loadStructures();
      onStructuresUpdated?.();
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to save fee structure.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the fee structure for "${name}"?`)) {
      return;
    }

    setIsSaving(true);
    setErrorNotice(null);
    try {
      const res = await feesService.deleteFeeStructure(id);
      if (res.error) throw new Error(res.error);
      setSuccessNotice(`Fee structure for "${name}" deleted.`);
      await loadStructures();
      onStructuresUpdated?.();
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to delete fee structure.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-400/20 text-amber-400 rounded-lg">
              <Layers size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Course Fee Plans & Structures
              </h2>
              <p className="text-xs text-slate-400">
                Setup and manage tuition rates, installment plans, and course packages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorNotice && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <Check size={15} className="text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Form to Add or Edit */}
          {isFormOpen ? (
            <form
              onSubmit={handleSubmit}
              className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 animate-scale-in"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-800">
                  {editingId ? "Edit Fee Structure" : "Add New Fee Structure"}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    label="Course / Batch Name"
                    required
                    placeholder="e.g. Secondary Board Prep (9th–10th)"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Academic Session"
                    required
                    placeholder="e.g. 2025-2026"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Input
                    label="Tuition Fee Amount (₹)"
                    type="number"
                    required
                    placeholder="e.g. 2200"
                    value={totalFee}
                    onChange={(e) => setTotalFee(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Input
                    label="Description / Inclusions"
                    placeholder="e.g. Monthly tuition fee for board prep"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  {editingId ? "Save Changes" : "Create Fee Plan"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Fee Structures ({structures.length})
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsFormOpen(true)}
                icon={<Plus size={14} />}
              >
                Add Fee Structure
              </Button>
            </div>
          )}

          {/* Table of Structures */}
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner label="Loading fee plans..." size="md" />
            </div>
          ) : structures.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No fee plans configured yet. Click "Add Fee Structure" above to define your first course fee rate.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Course / Batch</th>
                    <th className="px-4 py-3">Academic Year</th>
                    <th className="px-4 py-3">Tuition Fee</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {structures.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {s.course_name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral" size="sm">
                          {s.academic_year}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        ₹{s.total_fee.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {s.description || "Standard tuition rate"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleStartEdit(s)}
                          className="p-1 text-slate-400 hover:text-slate-800 rounded transition"
                          title="Edit Plan"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.course_name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Delete Plan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
