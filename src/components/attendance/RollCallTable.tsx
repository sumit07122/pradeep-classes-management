import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { Badge } from '../common';
import type { RollCallStudent, AttendanceStatus } from '../../types';

interface RollCallTableProps {
  students: RollCallStudent[];
  batchName: string;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onNoteChange: (studentId: string, note: string) => void;
  onBulkStatusChange: (status: AttendanceStatus) => void;
  readOnly?: boolean;
}

export const RollCallTable: React.FC<RollCallTableProps> = ({
  students,
  batchName,
  onStatusChange,
  onNoteChange,
  onBulkStatusChange,
  readOnly = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeNoteStudent, setActiveNoteStudent] = useState<string | null>(null);

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.admission_no.toLowerCase().includes(q) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student by name, admission no, or roll no..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16466f]"
          />
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden md:inline">Quick Set:</span>
            <button
              type="button"
              onClick={() => onBulkStatusChange('present')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              All Present
            </button>
            <button
              type="button"
              onClick={() => onBulkStatusChange('absent')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1"
            >
              <XCircle size={13} />
              All Absent
            </button>
          </div>
        )}
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-600 font-semibold tracking-wider text-[11px] uppercase">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Admission No</th>
              <th className="py-3 px-4">Roll No</th>
              <th className="py-3 px-4">Current Status</th>
              <th className="py-3 px-4 text-right">{readOnly ? 'Details' : 'Mark Presence'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  {students.length === 0
                    ? `No active students currently enrolled in ${batchName}.`
                    : 'No students match your search.'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((s) => {
                const initials = s.full_name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const isNoteOpen = activeNoteStudent === s.student_id;

                return (
                  <tr key={s.student_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-[11px] shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{s.full_name}</div>
                          {s.note && (
                            <div className="text-[11px] text-slate-500 italic flex items-center gap-1 mt-0.5">
                              <MessageSquare size={10} className="shrink-0 text-amber-500" />
                              <span>{s.note}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-600">{s.admission_no}</td>

                    <td className="py-3 px-4 text-slate-500">{s.roll_no || '—'}</td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          s.status === 'present'
                            ? 'success'
                            : s.status === 'absent'
                            ? 'danger'
                            : s.status === 'late'
                            ? 'warning'
                            : 'info'
                        }
                        size="sm"
                        showDot
                      >
                        {s.status.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {readOnly ? (
                        <span className="text-slate-400 text-[11px]">Recorded</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Present"
                            onClick={() => onStatusChange(s.student_id, 'present')}
                            className={`w-7 h-7 rounded-md font-bold text-xs transition-colors flex items-center justify-center ${
                              s.status === 'present'
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                            }`}
                          >
                            P
                          </button>

                          <button
                            type="button"
                            title="Absent"
                            onClick={() => onStatusChange(s.student_id, 'absent')}
                            className={`w-7 h-7 rounded-md font-bold text-xs transition-colors flex items-center justify-center ${
                              s.status === 'absent'
                                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700'
                            }`}
                          >
                            A
                          </button>

                          <button
                            type="button"
                            title="Late"
                            onClick={() => onStatusChange(s.student_id, 'late')}
                            className={`w-7 h-7 rounded-md font-bold text-xs transition-colors flex items-center justify-center ${
                              s.status === 'late'
                                ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700'
                            }`}
                          >
                            L
                          </button>

                          <button
                            type="button"
                            title="Leave / Excused"
                            onClick={() => onStatusChange(s.student_id, 'leave')}
                            className={`w-7 h-7 rounded-md font-bold text-xs transition-colors flex items-center justify-center ${
                              s.status === 'leave'
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                                : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700'
                            }`}
                          >
                            E
                          </button>

                          <button
                            type="button"
                            title="Add Note"
                            onClick={() => setActiveNoteStudent(isNoteOpen ? null : s.student_id)}
                            className={`w-7 h-7 rounded-md text-xs transition-colors flex items-center justify-center ${
                              s.note
                                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <MessageSquare size={13} />
                          </button>
                        </div>
                      )}

                      {/* Note Inline Expansion */}
                      {isNoteOpen && !readOnly && (
                        <div className="mt-2 text-left">
                          <input
                            type="text"
                            value={s.note || ''}
                            onChange={(e) => onNoteChange(s.student_id, e.target.value)}
                            placeholder="Add reason (e.g. sick leave, bus delayed)..."
                            className="w-full text-xs px-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:border-[#16466f] bg-white text-slate-800"
                            autoFocus
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
