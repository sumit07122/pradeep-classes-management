import React from "react";
import { ClipboardCheck, IndianRupee, BookOpen, Calendar, Award } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { StatCard, Badge } from "../components/common";

export const Portal: React.FC = () => {
  const { user, role, isDemoMode } = useAuth();

  return (
    <div className="space-y-6">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{role === "parent" ? "PARENT PORTAL" : "STUDENT PORTAL"}</div>
          <h1>Welcome, {user?.full_name || "Aarav Sharma"}</h1>
          <p>
            {role === "parent"
              ? "Monitor your ward's attendance, performance, and fee payment status."
              : "Review your classroom attendance, upcoming exams, fee receipts, and study resources."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="md">
            Admission No: PC-2026-001
          </Badge>
          <Badge variant="success" size="md">
            Batch: JEE Morning
          </Badge>
        </div>
      </div>

      <section className="stats-grid">
        <StatCard
          title="Attendance Rate"
          value="94.5%"
          delta="38/40 Days"
          note="present"
          icon={ClipboardCheck}
          tone="green"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Fee Status"
          value="Paid"
          delta="₹12,500"
          note="no pending dues"
          icon={IndianRupee}
          tone="blue"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Recent Score"
          value="88/100"
          delta="Rank 4"
          note="Physics Test #3"
          icon={Award}
          tone="violet"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Active Course"
          value="Class 12"
          delta="JEE Advanced"
          note="regular batch"
          icon={BookOpen}
          tone="amber"
          isDemo={isDemoMode}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Attendance Log</h3>
              <p>Your recorded attendance for the past sessions</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { date: "20 Nov 2026", subject: "Physics", status: "present" },
              { date: "19 Nov 2026", subject: "Chemistry", status: "present" },
              { date: "18 Nov 2026", subject: "Mathematics", status: "present" },
              { date: "17 Nov 2026", subject: "Physics", status: "absent" },
              { date: "16 Nov 2026", subject: "Chemistry", status: "present" },
            ].map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-slate-400" />
                  <span className="font-semibold text-slate-700">{log.date}</span>
                  <span className="text-slate-400">• {log.subject}</span>
                </div>
                <Badge
                  variant={log.status === "present" ? "success" : "danger"}
                  size="sm"
                  showDot
                >
                  {log.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Institute Notices & Announcements</h3>
              <p>Updates from Pradeep Classes administration</p>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#eaf2fa] border border-[#cde0f1] text-[#24496c]">
              <b className="block font-bold mb-1">Sunday JEE Mock Exam Schedule</b>
              <p className="text-[11px] leading-relaxed">
                JEE Mock Exam #4 will be conducted this Sunday from 9:00 AM to 12:00 PM. Please report 15 minutes before exam time with your student ID.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
              <b className="block font-bold mb-1">Winter Timetable Revision</b>
              <p className="text-[11px] leading-relaxed">
                Morning batches will start at 8:00 AM instead of 7:30 AM beginning next Monday.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
