import React from 'react';
import { UserCheck, UserX, Clock, CalendarX, TrendingUp } from 'lucide-react';
import type { AttendanceSummary } from '../../types';

interface AttendanceStatsProps {
  summary: AttendanceSummary;
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <UserCheck size={20} />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Present</div>
          <div className="text-xl font-bold text-slate-900">{summary.present_count}</div>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
          <UserX size={20} />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Absent</div>
          <div className="text-xl font-bold text-slate-900">{summary.absent_count}</div>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Clock size={20} />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Late</div>
          <div className="text-xl font-bold text-slate-900">{summary.late_count}</div>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <CalendarX size={20} />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Leave</div>
          <div className="text-xl font-bold text-slate-900">{summary.leave_count}</div>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          summary.attendance_rate >= 85
            ? 'bg-emerald-50 text-emerald-600'
            : summary.attendance_rate >= 75
            ? 'bg-amber-50 text-amber-600'
            : 'bg-rose-50 text-rose-600'
        }`}>
          <TrendingUp size={20} />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Turnout Rate</div>
          <div className="text-xl font-bold text-slate-900">{summary.attendance_rate}%</div>
        </div>
      </div>
    </div>
  );
};
