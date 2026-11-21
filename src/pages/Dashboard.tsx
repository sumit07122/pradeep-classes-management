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
  Calendar,
  Clock,
  BookCheck,
  Receipt,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Banknote,
} from "lucide-react";
import { StatCard, Button, LoadingSpinner, Badge, AlertNotice } from "../components/common";
import { WhatsAppNotificationModal, type NotificationTarget } from "../components/whatsapp/WhatsAppNotificationModal";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { feesService } from "../services/feesService";
import { attendanceService } from "../services/attendanceService";
import type { AttendanceDefaulter } from "../types";

export const Dashboard: React.FC = () => {
  const { role, user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Period Filter: today, week, month, session
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "session">("session");

  // Statistics
  const [studentCount, setStudentCount] = useState<number>(0);
  const [teacherCount, setTeacherCount] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<number>(0);
  const [feeSummary, setFeeSummary] = useState<{
    total_billed: number;
    total_collected: number;
    total_pending: number;
  }>({ total_billed: 0, total_collected: 0, total_pending: 0 });

  // Financial intelligence for Owner / Super Admin
  const [financeOverview, setFinanceOverview] = useState<{
    totalExpenses: number;
    pendingPayroll: number;
  }>({ totalExpenses: 0, pendingPayroll: 0 });

  const [paymentModeStats, setPaymentModeStats] = useState<{
    cash: number;
    upi: number;
    bank_transfer: number;
  }>({ cash: 0, upi: 0, bank_transfer: 0 });

  const [todayAttendance, setTodayAttendance] = useState<{
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  }>({ present: 0, absent: 0, late: 0, total: 0, percentage: 100 });

  const [defaulters, setDefaulters] = useState<AttendanceDefaulter[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [todayDiaryLogs, setTodayDiaryLogs] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [teacherBatches, setTeacherBatches] = useState<any[]>([]);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);

  // WhatsApp One-Click Modal
  const [whatsappModalData, setWhatsappModalData] = useState<{
    isOpen: boolean;
    targets: NotificationTarget[];
  }>({
    isOpen: false,
    targets: [],
  });

  const [notice, setNotice] = useState<{ type: "success" | "info"; message: string } | null>(null);

  useEffect(() => {
    loadDashboardMetrics();
  }, [user, role, selectedPeriod]);

  const loadDashboardMetrics = async () => {
    setLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      setStudentCount(0);
      setTeacherCount(0);
      setBatchCount(0);
      setFeeSummary({ total_billed: 0, total_collected: 0, total_pending: 0 });
      setTodayAttendance({ present: 0, absent: 0, late: 0, total: 0, percentage: 0 });
      setLoading(false);
      return;
    }

    try {
      // 1. Live entity counts
      const [
        { count: sCount },
        { count: tCount },
        { count: bCount },
        fSummary,
        defaultersRes,
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
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

      // 2. Today's real attendance
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

      // 3. Recent payments
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

      // 4. Financials for Owner & Super Admin & Admin
      if (role === "owner" || role === "super_admin" || role === "admin") {
        const [{ data: expData }, { data: payData }, overdueRes, { data: modeRows }, { data: diaryRows }] =
          await Promise.all([
            supabase.from("institute_expenses").select("amount").eq("status", "approved"),
            supabase.from("teacher_payrolls").select("net_payable").eq("status", "pending"),
            feesService.getFeeRecords({ status: "overdue" }).catch(() => ({ data: [] })),
            supabase.from("fee_payments").select("payment_mode, amount").eq("is_reversal", false),
            supabase
              .from("class_diaries")
              .select("id, subject, topics_covered, batches(name), teachers(full_name)")
              .eq("date", today)
              .limit(5),
          ]);

        const totExp = (expData || []).reduce((acc: number, x: any) => acc + Number(x.amount || 0), 0);
        const totPay = (payData || []).reduce((acc: number, x: any) => acc + Number(x.net_payable || 0), 0);
        setFinanceOverview({ totalExpenses: totExp, pendingPayroll: totPay });
        setOverdueInvoices(overdueRes.data.slice(0, 5));
        setTodayDiaryLogs(diaryRows || []);

        let cashSum = 0;
        let upiSum = 0;
        let bankSum = 0;
        (modeRows || []).forEach((m: any) => {
          const mode = (m.payment_mode || "").toLowerCase();
          const amt = Number(m.amount || 0);
          if (mode === "cash") cashSum += amt;
          else if (mode === "upi") upiSum += amt;
          else bankSum += amt;
        });
        setPaymentModeStats({ cash: cashSum, upi: upiSum, bank_transfer: bankSum });
      }

      // 5. If Teacher role, load assigned batches and today's schedule
      if (role === "teacher" && user?.id) {
        const { data: tRow } = await supabase
          .from("teachers")
          .select("id, full_name")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (tRow) {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const currentDay = days[new Date().getDay()];

          const [{ data: tb }, { data: todaySlots }] = await Promise.all([
            supabase
              .from("teacher_batches")
              .select("batch_id, batches(id, name, course_name, max_capacity, timing, room_number)")
              .eq("teacher_id", tRow.id),
            supabase
              .from("timetables")
              .select("id, batch_id, subject, start_time, end_time, room_number, batches(id, name)")
              .eq("teacher_id", tRow.id)
              .ilike("day_of_week", currentDay)
              .order("start_time"),
          ]);

          setTeacherBatches((tb || []).map((x: any) => x.batches).filter(Boolean));
          setTodayClasses(todaySlots || []);
        }
      }
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemindOverdue = (inv: any) => {
    setWhatsappModalData({
      isOpen: true,
      targets: [
        {
          student_id: inv.student_id,
          student_name: inv.student_name,
          batch_name: inv.batch_name,
          amount_due: inv.balance_due,
          fee_title: inv.title,
          phone: inv.student_phone,
          parent_name: inv.parent_name,
          parent_phone: inv.parent_phone,
          record_id: inv.id,
        },
      ],
    });
  };

  if (loading) {
    return <LoadingSpinner label="Loading real-time institute metrics..." size="lg" />;
  }

  const isTeacher = role === "teacher";
  const isOwnerOrSuper = role === "owner" || role === "super_admin";
  const netSurplus = feeSummary.total_collected - financeOverview.totalExpenses;
  const collectionRate =
    feeSummary.total_billed > 0
      ? ((feeSummary.total_collected / feeSummary.total_billed) * 100).toFixed(1)
      : "100";

  return (
    <div className="space-y-6">
      {notice && (
        <AlertNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Top Banner with Institute Branding */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Pradeep Classes"
            className="w-14 h-14 object-contain rounded-2xl bg-white p-1 border border-slate-200 shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#102f50] text-amber-300">
                {isTeacher
                  ? "FACULTY ACADEMIC WORKSPACE"
                  : isOwnerOrSuper
                  ? "INSTITUTE EXECUTIVE SUITE"
                  : "OPERATIONS & ADMINISTRATION"}
              </span>
              <span className="text-xs text-slate-400 font-medium">Session 2026-27</span>
            </div>
            <h1 className="text-2xl font-black text-[#102f50] font-['Manrope'] mt-1">
              Pradeep Classes Management Platform
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>Narsi Vihar, Transport Nagar, Mathura, UP</span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> System Online
              </span>
            </p>
          </div>
        </div>

        {/* Quick Period Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start lg:self-auto">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "session", label: "Session 2026-27" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedPeriod(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedPeriod === tab.id
                  ? "bg-[#102f50] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teacher's Today's Work Section */}
      {isTeacher && (
        <div className="bg-white rounded-xl border border-blue-200/80 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="text-[#16466f]" size={18} />
              <h3 className="font-bold text-slate-900 text-sm">
                Today's Scheduled Classes ({todayClasses.length})
              </h3>
            </div>
            <Link to="/timetable" className="text-xs font-bold text-[#16466f] hover:underline">
              Full Timetable →
            </Link>
          </div>

          {todayClasses.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 italic">
              No classes scheduled for you today. Check your weekly timetable for upcoming lectures.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todayClasses.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-bold text-[#16466f] flex items-center gap-1 font-mono">
                        <Clock size={12} />
                        {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                      </span>
                      <Badge variant="blue" size="sm">
                        {c.room_number || "Room 101"}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{c.subject}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{c.batches?.name || "Assigned Batch"}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                    <Link to={`/attendance`} className="flex-1">
                      <Button variant="primary" size="sm" className="w-full text-xs">
                        Take Attendance
                      </Button>
                    </Link>
                    <Link to={`/diary`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Write Diary
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {teacherBatches.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <BookOpen size={13} className="text-[#16466f]" />
                <span className="font-bold">Your Assigned Batches:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {teacherBatches.map((b) => (
                  <span key={b.id} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold">
                    {b.name} ({b.course_name})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        <StatCard
          title="Active Students"
          value={String(studentCount).padStart(2, "0")}
          note="enrolled & attending"
          icon={Users}
          tone="blue"
        />
        <StatCard
          title="Active Batches"
          value={String(batchCount).padStart(2, "0")}
          note="JEE & NEET sections"
          icon={BookOpen}
          tone="amber"
        />
        <StatCard
          title="Faculty Members"
          value={String(teacherCount).padStart(2, "0")}
          note="active teaching staff"
          icon={GraduationCap}
          tone="violet"
        />
        <StatCard
          title="Total Fees Collected"
          value={`₹${feeSummary.total_collected.toLocaleString("en-IN")}`}
          note={`${collectionRate}% collected`}
          icon={IndianRupee}
          tone="green"
        />
        <StatCard
          title="Operating Expenses"
          value={`₹${financeOverview.totalExpenses.toLocaleString("en-IN")}`}
          note="approved vouchers"
          icon={Receipt}
          tone="rose"
        />
        <StatCard
          title="Operating Surplus"
          value={`₹${netSurplus.toLocaleString("en-IN")}`}
          note={netSurplus >= 0 ? "healthy surplus" : "net deficit"}
          icon={TrendingUp}
          tone={netSurplus >= 0 ? "green" : "rose"}
        />
        <StatCard
          title="Today's Attendance"
          value={todayAttendance.total > 0 ? `${todayAttendance.percentage.toFixed(0)}%` : "100%"}
          note={`${todayAttendance.present} present today`}
          icon={ClipboardCheck}
          tone="blue"
        />
      </section>

      {/* Financial Health & Payment Methods Suite (Owner / Super Admin) */}
      {(isOwnerOrSuper || role === "admin") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tuition Collection Efficiency */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-[#102f50] text-sm font-['Manrope']">Tuition Billing & Dues</h3>
                <p className="text-xs text-slate-400">Total invoiced fees vs actual collected</p>
              </div>
              <Badge variant="blue" size="sm">
                ₹{feeSummary.total_billed.toLocaleString("en-IN")} Total
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Recovery Rate: {collectionRate}%</span>
                <span className="font-bold text-rose-600">₹{feeSummary.total_pending.toLocaleString("en-IN")} Dues</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, Number(collectionRate)))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <span className="text-[11px] text-emerald-800 font-medium block">Total Collected</span>
                <b className="text-base text-emerald-900 font-['Manrope']">
                  ₹{feeSummary.total_collected.toLocaleString("en-IN")}
                </b>
              </div>
              <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                <span className="text-[11px] text-rose-800 font-medium block">Outstanding Balance</span>
                <b className="text-base text-rose-900 font-['Manrope']">
                  ₹{feeSummary.total_pending.toLocaleString("en-IN")}
                </b>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-[#102f50] text-sm font-['Manrope']">Payment Channels</h3>
                <p className="text-xs text-slate-400">Reconciled fees by settlement mode</p>
              </div>
              <CreditCard size={16} className="text-[#102f50]" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <Smartphone size={15} className="text-blue-600" />
                  <span className="font-semibold text-slate-700">UPI / QR Code</span>
                </div>
                <b className="font-mono text-slate-900">₹{paymentModeStats.upi.toLocaleString("en-IN")}</b>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <Banknote size={15} className="text-emerald-600" />
                  <span className="font-semibold text-slate-700">Cash Collections</span>
                </div>
                <b className="font-mono text-slate-900">₹{paymentModeStats.cash.toLocaleString("en-IN")}</b>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-purple-600" />
                  <span className="font-semibold text-slate-700">Bank Transfer / IMPS</span>
                </div>
                <b className="font-mono text-slate-900">₹{paymentModeStats.bank_transfer.toLocaleString("en-IN")}</b>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-gradient-to-br from-[#102f50] to-[#1c4b77] text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Quick Operations</span>
              <h3 className="text-lg font-bold font-['Manrope'] mt-1">Management Actions</h3>
              <p className="text-xs text-slate-200 leading-relaxed mt-1">
                One-click shortcuts to admit new students, collect tuition, or issue announcements.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link to="/students">
                <button className="w-full p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold flex items-center justify-center gap-1.5 transition">
                  <Plus size={14} /> Admit Student
                </button>
              </Link>
              <Link to="/fees">
                <button className="w-full p-2.5 bg-amber-400 hover:bg-amber-500 text-[#102f50] rounded-xl font-bold flex items-center justify-center gap-1.5 transition">
                  <IndianRupee size={14} /> Collect Fee
                </button>
              </Link>
              <Link to="/attendance">
                <button className="w-full p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold flex items-center justify-center gap-1.5 transition">
                  <ClipboardCheck size={14} /> Roll Call
                </button>
              </Link>
              <Link to="/announcements">
                <button className="w-full p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold flex items-center justify-center gap-1.5 transition">
                  <MessageSquare size={14} /> Broadcast
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Action Center & Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Overdue Invoices with 1-Click WhatsApp Remind */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-[#102f50] text-sm font-['Manrope'] flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-500" />
                  Overdue Fee Invoices ({overdueInvoices.length})
                </h3>
                <p className="text-xs text-slate-400">Past-due tuition requiring immediate recovery</p>
              </div>
              <Link to="/fees" className="text-xs font-bold text-[#16466f] hover:underline flex items-center gap-1">
                All Fees <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-3">
              {overdueInvoices.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 italic">
                  No overdue fees recorded. All student tuition is on schedule.
                </div>
              ) : (
                overdueInvoices.map((inv) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <b className="text-slate-800 block">{inv.student_name}</b>
                      <span className="text-slate-400 font-mono text-[11px]">
                        Due ₹{inv.balance_due.toLocaleString("en-IN")} • {inv.batch_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemindOverdue(inv)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 transition"
                      title="Send WhatsApp Reminder"
                    >
                      <MessageSquare size={12} className="text-emerald-600" />
                      Remind
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-right">
            <Link to="/fees" className="text-xs font-bold text-[#16466f] hover:underline">
              Open Fee Recovery Register →
            </Link>
          </div>
        </div>

        {/* Center: Attendance Defaulters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-[#102f50] text-sm font-['Manrope'] flex items-center gap-1.5">
                  <ShieldAlert size={15} className="text-rose-600" />
                  Attendance Defaulters (&lt;75%)
                </h3>
                <p className="text-xs text-slate-400">Students flagged below mandatory threshold</p>
              </div>
              <Badge variant={defaulters.length > 0 ? "red" : "green"} size="sm">
                {defaulters.length} Flagged
              </Badge>
            </div>

            <div className="divide-y divide-slate-100 mt-3">
              {defaulters.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 italic">
                  Excellent! All enrolled students maintain compliance above 75%.
                </div>
              ) : (
                defaulters.map((d) => (
                  <div key={d.student_id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <b className="text-slate-800 block">{d.student_name}</b>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {d.admission_no} • {d.batch_name}
                      </span>
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
              Audit Attendance Register →
            </Link>
          </div>
        </div>

        {/* Right: Today's Conducted Lectures & Diary Audit */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-[#102f50] text-sm font-['Manrope'] flex items-center gap-1.5">
                  <BookCheck size={15} className="text-blue-600" />
                  Today's Lectures & Diary
                </h3>
                <p className="text-xs text-slate-400">Logged class topics & syllabus progress</p>
              </div>
              <Link to="/diary" className="text-xs font-bold text-[#16466f] hover:underline flex items-center gap-1">
                Diary <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-3">
              {todayDiaryLogs.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 italic">
                  No class diary logs submitted yet today. Teachers submit entries after concluding lectures.
                </div>
              ) : (
                todayDiaryLogs.map((dl) => (
                  <div key={dl.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <b className="text-slate-800">{dl.subject}</b>
                      <span className="text-[11px] text-slate-400">{dl.batches?.name}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 truncate">
                      {dl.topics_covered || "Topics not specified"}
                    </p>
                    <span className="text-[10px] text-slate-400">Faculty: {dl.teachers?.full_name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-right">
            <Link to="/diary" className="text-xs font-bold text-[#16466f] hover:underline">
              Inspect Full Syllabus Progress →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Collections Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-[#102f50] text-sm font-['Manrope']">Recent Fee Collections</h3>
            <p className="text-xs text-slate-400">Audited student payment transactions</p>
          </div>
          <Link to="/fees" className="text-xs font-bold text-[#16466f] hover:underline flex items-center gap-1">
            Ledger <ArrowUpRight size={13} />
          </Link>
        </div>

        {recentPayments.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 italic">
            No fee payments recorded recently.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {recentPayments.map((p) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div className="font-bold text-slate-800 truncate">{(p.students as any)?.full_name || "Student"}</div>
                <div className="font-mono text-[11px] text-slate-400 mt-0.5">{p.receipt_no} • {p.payment_mode?.toUpperCase()}</div>
                <div className={`mt-2 font-bold ${p.is_reversal ? "text-rose-600" : "text-emerald-700"}`}>
                  {p.is_reversal ? "- " : "+ "}₹{Number(p.amount).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp One-Click Notification Modal */}
      <WhatsAppNotificationModal
        isOpen={whatsappModalData.isOpen}
        onClose={() => setWhatsappModalData((prev) => ({ ...prev, isOpen: false }))}
        type="fee_reminder"
        targets={whatsappModalData.targets}
        onSuccess={(count) => {
          setNotice({
            type: "success",
            message: `${count} WhatsApp fee reminder(s) successfully queued for dispatch.`,
          });
        }}
      />
    </div>
  );
};
