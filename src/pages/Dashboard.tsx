import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  ClipboardCheck,
  IndianRupee,
  BookOpen,
  ArrowUpRight,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { StatCard, Button, LoadingSpinner, Badge } from "../components/common";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { feesService } from "../services/feesService";
import { attendanceService } from "../services/attendanceService";
import type { AttendanceDefaulter } from "../types";

export const Dashboard: React.FC = () => {
  const { role, user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Statistics
  const [studentCount, setStudentCount] = useState<number>(0);
  const [teacherCount, setTeacherCount] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<number>(0);
  const [feeSummary, setFeeSummary] = useState<{
    total_billed: number;
    total_collected: number;
    total_pending: number;
  }>({ total_billed: 0, total_collected: 0, total_pending: 0 });

  const [todayAttendance, setTodayAttendance] = useState<{
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  }>({ present: 0, absent: 0, late: 0, total: 0, percentage: 100 });

  const [defaulters, setDefaulters] = useState<AttendanceDefaulter[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [teacherBatches, setTeacherBatches] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [user, role]);

  const loadDashboardMetrics = async () => {
    setLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      setStudentCount(24);
      setTeacherCount(4);
      setBatchCount(3);
      setFeeSummary({ total_billed: 120000, total_collected: 75000, total_pending: 45000 });
      setTodayAttendance({ present: 22, absent: 2, late: 0, total: 24, percentage: 91.6 });
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch live entity counts
      const [
        { count: sCount },
        { count: tCount },
        { count: bCount },
        fSummary,
        defaultersRes,
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("batches").select("id", { count: "exact", head: true }),
        feesService.getFeeSummary().catch(() => ({ total_billed: 0, total_collected: 0, total_pending: 0 })),
        attendanceService.getAttendanceDefaulters(75.0).catch(() => []),
      ]);

      setStudentCount(sCount ?? 0);
      setTeacherCount(tCount ?? 0);
      setBatchCount(bCount ?? 0);
      setFeeSummary({
        total_billed: fSummary.total_billed,
        total_collected: fSummary.total_collected,
        total_pending: fSummary.total_pending,
      });
      setDefaulters(defaultersRes.slice(0, 5));

      // 2. Fetch today's real attendance
      const today = new Date().toISOString().split("T")[0];
      const { data: todaySessions } = await supabase
        .from("attendance_sessions")
        .select(`
          id,
          attendance_records ( status )
        `)
        .eq("session_date", today);

      if (todaySessions && todaySessions.length > 0) {
        let p = 0;
        let a = 0;
        let l = 0;
        let tot = 0;

        todaySessions.forEach((sess: any) => {
          (sess.attendance_records || []).forEach((r: any) => {
            tot++;
            if (r.status === "present") p++;
            else if (r.status === "absent") a++;
            else if (r.status === "late") l++;
          });
        });

        const pct = tot > 0 ? (p / tot) * 100 : 100;
        setTodayAttendance({ present: p, absent: a, late: l, total: tot, percentage: pct });
      }

      // 3. Fetch recent payments
      const { data: payments } = await supabase
        .from("fee_payments")
        .select(`
          id,
          amount,
          receipt_no,
          payment_mode,
          payment_date,
          is_reversal,
          students ( full_name )
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentPayments(payments || []);

      // 4. If Teacher role, load their assigned batches
      if (role === "teacher" && user?.id) {
        const { data: tRow } = await supabase
          .from("teachers")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (tRow) {
          const { data: tb } = await supabase
            .from("teacher_batches")
            .select("batch_id, batches(id, name, course_name, current_capacity, max_capacity)")
            .eq("teacher_id", tRow.id);

          setTeacherBatches((tb || []).map((x: any) => x.batches).filter(Boolean));
        }
      }
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading real-time institute metrics..." size="lg" />;
  }

  const isTeacher = role === "teacher";

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">INSTITUTE EXECUTIVE OVERVIEW</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">
            Welcome back, {user?.full_name || "Administrator"}
          </h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? "Here are your assigned batches and student attendance status today."
              : "Live operations overview for Pradeep Classes Coaching Campus."}
          </p>
        </div>

        <div className="flex gap-2">
          {!isTeacher && (
            <Link to="/students">
              <Button variant="primary" icon={<Plus size={16} />}>
                Admit Student
              </Button>
            </Link>
          )}
          <Link to="/attendance">
            <Button variant="outline" icon={<ClipboardCheck size={16} />}>
              Mark Roll Call
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="stats-grid">
        <StatCard
          title="Active Students"
          value={String(studentCount).padStart(2, "0")}
          note="enrolled & attending"
          icon={Users}
          tone="blue"
        />
        <StatCard
          title="Faculty Members"
          value={String(teacherCount).padStart(2, "0")}
          note="active teaching staff"
          icon={GraduationCap}
          tone="violet"
        />
        <StatCard
          title="Active Batches"
          value={String(batchCount).padStart(2, "0")}
          note="classroom sections"
          icon={BookOpen}
          tone="amber"
        />
        <StatCard
          title="Fee Collections"
          value={`₹${feeSummary.total_collected.toLocaleString()}`}
          note={`₹${feeSummary.total_pending.toLocaleString()} pending`}
          icon={IndianRupee}
          tone="green"
        />
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Today's Attendance</h3>
                <p className="text-xs text-slate-500">Cross-batch real-time presence</p>
              </div>
              <Link to="/attendance" className="text-xs font-bold text-[#16466f] hover:underline flex items-center gap-1">
                Full roll <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="py-6 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full border-4 border-[#16466f] flex flex-col items-center justify-center text-center shadow-inner">
                <span className="text-2xl font-black text-[#16466f]">
                  {todayAttendance.total > 0 ? `${todayAttendance.percentage.toFixed(0)}%` : "N/A"}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  {todayAttendance.total > 0 ? "Present" : "No Session"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <span className="text-emerald-700 block font-bold text-sm">{todayAttendance.present}</span>
                <span className="text-slate-500 text-[11px]">Present</span>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg">
                <span className="text-rose-700 block font-bold text-sm">{todayAttendance.absent}</span>
                <span className="text-slate-500 text-[11px]">Absent</span>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <span className="text-amber-700 block font-bold text-sm">{todayAttendance.late}</span>
                <span className="text-slate-500 text-[11px]">Late</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center / Defaulters Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-rose-600" />
                  Attendance Defaulters
                </h3>
                <p className="text-xs text-slate-500">Students with attendance &lt; 75%</p>
              </div>
              <Badge variant={defaulters.length > 0 ? "red" : "green"} size="sm">
                {defaulters.length} Defaulters
              </Badge>
            </div>

            <div className="divide-y divide-slate-100 mt-3">
              {defaulters.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 italic">
                  Excellent! All active students maintain compliance above 75%.
                </div>
              ) : (
                defaulters.map((d) => (
                  <div key={d.student_id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <b className="text-slate-800 block">{d.student_name}</b>
                      <span className="text-slate-400 font-mono text-[11px]">{d.admission_no} • {d.batch_name}</span>
                    </div>
                    <Badge variant="red" size="sm">
                      {d.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-right">
            <Link to="/attendance" className="text-xs font-bold text-[#16466f] hover:underline">
              View Defaulters Report →
            </Link>
          </div>
        </div>

        {/* Right / Recent Transactions or Faculty Batches */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          {isTeacher ? (
            <div>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base">Your Assigned Batches</h3>
                <p className="text-xs text-slate-500">Classes assigned to your timetable</p>
              </div>

              <div className="divide-y divide-slate-100 mt-3">
                {teacherBatches.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    No batches assigned to your profile yet.
                  </div>
                ) : (
                  teacherBatches.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <b className="text-slate-800 block text-sm">{b.name}</b>
                        <span className="text-slate-500">{b.course_name}</span>
                      </div>
                      <Badge variant="blue" size="sm">
                        {b.current_capacity || 0} / {b.max_capacity} Seats
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Recent Collections</h3>
                  <p className="text-xs text-slate-500">Latest settled fee payments</p>
                </div>
                <Link to="/fees" className="text-xs font-bold text-[#16466f] hover:underline flex items-center gap-1">
                  Ledger <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="divide-y divide-slate-100 mt-3">
                {recentPayments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    No fee payments recorded recently.
                  </div>
                ) : (
                  recentPayments.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <b className="text-slate-800 block">{(p.students as any)?.full_name || "Student"}</b>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {p.receipt_no} • {p.payment_mode?.toUpperCase()}
                        </span>
                      </div>
                      <span className={`font-bold ${p.is_reversal ? "text-rose-600" : "text-emerald-700"}`}>
                        {p.is_reversal ? "- " : "+ "}₹{Number(p.amount).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 text-right">
            <Link to={isTeacher ? "/timetable" : "/fees"} className="text-xs font-bold text-[#16466f] hover:underline">
              {isTeacher ? "Open My Timetable →" : "Open Full Fee Center →"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
