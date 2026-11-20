import React, { useState, useEffect } from 'react';
import { PlusCircle, AlertCircle } from 'lucide-react';
import { Modal, Button, LoadingSpinner } from '../common';
import { feesService } from '../../services/feesService';
import { studentsService } from '../../services/studentsService';
import type { Student, FeeStructure } from '../../types';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [title, setTitle] = useState('Tuition Fee - Installment 1');
  const [amount, setAmount] = useState<number>(20000);

  // Default due date to 14 days from now
  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  };

  const [dueDate, setDueDate] = useState<string>(getDefaultDueDate());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const [studentsRes, structuresRes] = await Promise.all([
        studentsService.getStudents({ status: 'Active', pageSize: 100 }),
        feesService.getFeeStructures(),
      ]);

      const activeStudents = studentsRes.data || [];
      setStudents(activeStudents);
      setFeeStructures(structuresRes);

      if (activeStudents.length > 0) {
        setSelectedStudentId(activeStudents[0].id);
      }
      if (structuresRes.length > 0) {
        setSelectedStructureId(structuresRes[0].id);
        setAmount(structuresRes[0].total_fee);
        setTitle(`${structuresRes[0].course_name} Tuition`);
      }
    } catch (err: any) {
      console.error('Failed to load invoice modal data:', err);
      setError(err.message || 'Failed to load enrolled students and fee catalog.');
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleStructureSelect = (structId: string) => {
    setSelectedStructureId(structId);
    if (!structId) return;

    const matched = feeStructures.find((f) => f.id === structId);
    if (matched) {
      setTitle(`${matched.course_name} Tuition`);
      setAmount(matched.total_fee);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('Please select an enrolled student.');
      return;
    }
    if (amount <= 0) {
      setError('Invoice amount must be greater than zero.');
      return;
    }
    if (!dueDate) {
      setError('Please specify an invoice due date.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await feesService.createInvoice({
        student_id: selectedStudentId,
        title: title.trim(),
        amount,
        due_date: dueDate,
        notes: notes.trim() || undefined,
        fee_structure_id: selectedStructureId || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      setError(err.message || 'Failed to create fee invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Student Fee Invoice / Installment"
    >
      {loadingInitial ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : students.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          <AlertCircle size={28} className="mx-auto text-amber-500 mb-2" />
          <b className="font-bold block text-slate-800 text-sm">No Active Students Found</b>
          <p className="mt-1">
            You must have enrolled students in Pradeep Classes before creating fee invoices.
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Student <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.admission_no}) — {s.batch_name}
                </option>
              ))}
            </select>
          </div>

          {/* Fee Structure Template */}
          {feeStructures.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fee Structure Template <span className="text-slate-400">(Optional)</span>
              </label>
              <select
                value={selectedStructureId}
                onChange={(e) => handleStructureSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
              >
                <option value="">-- Custom / Ad-hoc Invoice --</option>
                {feeStructures.map((fs) => (
                  <option key={fs.id} value={fs.id}>
                    {fs.course_name} ({fs.academic_year}) — ₹{fs.total_fee.toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fee Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Invoice Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Term 1 Tuition, Study Material Fee"
              required
              className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
            />
          </div>

          {/* Amount & Due Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="1"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full pl-8 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes / Instructions <span className="text-slate-400">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Installment 1 of 2. Payment due before start of classes."
              className="w-full px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={submitting}
              icon={<PlusCircle size={14} />}
            >
              Issue Invoice
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
