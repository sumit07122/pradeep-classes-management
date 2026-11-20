import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, Download, RefreshCw } from 'lucide-react';
import { Modal, Button, LoadingSpinner } from '../common';
import { attendanceService } from '../../services/attendanceService';
import type { BatchDefaulter } from '../../types';

interface AttendanceDefaultersModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
}

export const AttendanceDefaultersModal: React.FC<AttendanceDefaultersModalProps> = ({
  isOpen,
  onClose,
  batchId,
  batchName,
}) => {
  const [defaulters, setDefaulters] = useState<BatchDefaulter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && batchId) {
      loadDefaulters();
    }
  }, [isOpen, batchId]);

  const loadDefaulters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await attendanceService.getBatchDefaulters(batchId, 75.0);
      setDefaulters(data);
    } catch (err: any) {
      console.error('Failed to load defaulters:', err);
      setError(err.message || 'Failed to calculate attendance defaulters');
    } finally {
      setLoading(false);
    }
  };

  const exportDefaultersCsv = () => {
    if (defaulters.length === 0) return;
    const headers = ['Admission No', 'Student Name', 'Attendance Rate', 'Total Sessions', 'Attended', 'Absent', 'Parent Phone', 'Student Phone'];
    const rows = defaulters.map((d) => [
      `"${d.admission_no}"`,
      `"${d.full_name}"`,
      `"${d.attendance_percentage}%"`,
      d.total_sessions,
      d.attended_sessions,
      d.absent_count,
      `"${d.parent_phone || ''}"`,
      `"${d.phone || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Defaulters_${batchName.replace(/\s+/g, '_')}_under_75pct.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Attendance Alert (< 75%) • ${batchName}`}
    >
      <div className="space-y-4">
        {/* Banner */}
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-800">
          <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <div className="font-bold">75% Mandatory Attendance Policy</div>
            Students listed below have accumulated excessive absences and fall below the 75% institute minimum threshold. Contact parents or issue formal academic notices.
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600">
            {defaulters.length} {defaulters.length === 1 ? 'student' : 'students'} flagged
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDefaulters}
              icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
            {defaulters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportDefaultersCsv}
                icon={<Download size={13} />}
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs">
            {error}
          </div>
        ) : defaulters.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-slate-100">
            <div className="font-semibold text-emerald-700 mb-1">No attendance defaulters!</div>
            All students in {batchName} have maintained 75% or higher attendance.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Admission No</th>
                  <th className="py-2.5 px-3">Rate</th>
                  <th className="py-2.5 px-3">Sessions (Att / Total)</th>
                  <th className="py-2.5 px-3">Parent Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {defaulters.map((d) => (
                  <tr key={d.student_id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-semibold text-slate-900">{d.full_name}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{d.admission_no}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                        {d.attendance_percentage}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {d.attended_sessions} / {d.total_sessions}
                    </td>
                    <td className="py-2 px-3">
                      {d.parent_phone ? (
                        <a
                          href={`tel:${d.parent_phone}`}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                        >
                          <Phone size={11} />
                          {d.parent_phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Not recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
