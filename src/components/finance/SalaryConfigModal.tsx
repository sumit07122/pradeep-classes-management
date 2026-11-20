import React, { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "../common";
import { updateTeacherSalaryConfig } from "../../services/financeService";
import type { TeacherSalaryConfig } from "../../types/finance";

interface SalaryConfigModalProps {
  isOpen: boolean;
  config: TeacherSalaryConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const SalaryConfigModal: React.FC<SalaryConfigModalProps> = ({
  isOpen,
  config,
  onClose,
  onSuccess,
}) => {
  const [calculationType, setCalculationType] = useState<"monthly_fixed" | "per_lecture" | "hourly">("monthly_fixed");
  const [baseAmount, setBaseAmount] = useState<string>("0");
  const [perLectureRate, setPerLectureRate] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setCalculationType(config.calculation_type);
      setBaseAmount(config.base_amount.toString());
      setPerLectureRate(config.per_lecture_rate.toString());
    }
  }, [config]);

  if (!isOpen || !config) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = parseFloat(baseAmount) || 0;
    const rate = parseFloat(perLectureRate) || 0;

    if (base < 0 || rate < 0) {
      setError("Salary amounts cannot be negative");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await updateTeacherSalaryConfig(config.teacher_id, calculationType, base, rate);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error updating salary config:", err);
      setError(err.message || "Failed to update salary configuration");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-['Inter']">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 bg-[#102f50] text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold font-['Manrope']">Configure Faculty Compensation</h3>
            <p className="text-[11px] text-slate-300">{config.teacher_name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pay Calculation Model *</label>
            <select
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value as any)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="monthly_fixed">Fixed Monthly Salary</option>
              <option value="per_lecture">Per-Lecture Compensation</option>
              <option value="hourly">Hourly Billing Rate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Base Monthly Salary (₹)</label>
            <input
              type="number"
              min="0"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white font-mono"
              placeholder="e.g. 60000"
            />
            <span className="text-[10px] text-slate-400">Guaranteed monthly base retainer</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Per-Lecture / Hourly Rate (₹)</label>
            <input
              type="number"
              min="0"
              value={perLectureRate}
              onChange={(e) => setPerLectureRate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white font-mono"
              placeholder="e.g. 1500"
            />
            <span className="text-[10px] text-slate-400">Multiplied by delivered lecture count</span>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs bg-[#102f50] hover:bg-[#163a60] text-white">
              {isSubmitting ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
