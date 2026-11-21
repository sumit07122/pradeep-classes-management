import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  IndianRupee,
  Award,
  AlertCircle,
  CheckCircle2,
  Download,
  FolderDown,
  Clock,
  Printer,
  ShieldAlert,
  Flame,
  Trophy,
  FileCheck2,
  Sparkles,
  Settings,
  GraduationCap,
  Home,
  Bell,
  BookCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { StatCard, Badge, LoadingSpinner, Button } from "../components/common";
import { attendanceService } from "../services/attendanceService";
import { feesService } from "../services/feesService";
import { academicsService } from "../services/academicsService";
import { materialsService } from "../services/materialsService";
import { timetableService } from "../services/timetableService";
import { diaryService } from "../services/diaryService";
import { announcementsService } from "../services/announcementsService";
import { PrintableReceiptModal } from "../components/fees";
import { supabase } from "../lib/supabase";
import type { StudentAttendanceStats, FeeRecord, Announcement } from "../types";
import type { StudentExamResult } from "../types/academics";
import type { StudyMaterial } from "../types/materials";
import type { TimetableEntry } from "../types/timetable";
import type {
  StudentStreak,
  StudentBadge,
  StudentPointsRecord,
  StudentCertificate,
  ClassSession,
} from "../types/diary";

export const Portal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "homework"
    | "attendance"
    | "exams"
    | "fees"
    | "materials"
    | "timetable"
    | "gamification"
    | "certificates"
  >("overview");

  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    full_name: string;
    admission_no: string;
    batch_id: string;
    batch_name: string;
    course_name: string;
  } | null>(null);

  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<
    {
      id: string;
      session_date: string;
      batch_name: string;
      status: string;
      note: string | null;
    }[]
  >([]);

  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [examResults, setExamResults] = useState<StudentExamResult[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [classSessions, setClassSessions] = useState<ClassSession[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [gamification, setGamification] = useState<{
    streak: StudentStreak | null;
    badges: StudentBadge[];
    points: StudentPointsRecord[];
    totalPoints: number;
  }>({ streak: null, badges: [], points: [], totalPoints: 0 });
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);

  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortalData();
  }, [user]);

  const loadPortalData = async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Find the student profile matching current user
      const { data: studentData } = await supabase
        .from("students")
        .select("id, full_name, admission_no, batch_id, batches(name, course_name)")
        .eq("profile_id", user.id)
        .maybeSingle();

      let targetStudentId = studentData?.id;
      let targetStudent = studentData;

      if (!targetStudentId) {
        setStudentInfo(null);
        setLoading(false);
        return;
      }

      if (targetStudentId && targetStudent) {
        setStudentInfo({
          id: targetStudentId,
          full_name: targetStudent.full_name,
          admission_no: targetStudent.admission_no,
          batch_id: targetStudent.batch_id,
          batch_name: (targetStudent.batches as any)?.name || "Assigned Batch",
          course_name: (targetStudent.batches as any)?.course_name || "Enrolled Course",
        });

        // Parallel fetch for attendance, fees, exams, materials, timetable, sessions, announcements, gamification, and certificates
        const [
          statsRes,
          logsRes,
          feesRes,
          examsRes,
          matRes,
          timeRes,
          sessionsRes,
          annRes,
          gamifyRes,
          certRes,
        ] = await Promise.all([
          attendanceService.getStudentAttendanceSummary(targetStudentId).catch(() => null),
          attendanceService.getStudentRecentAttendance(targetStudentId, 10).catch(() => []),
          feesService.getStudentFeeRecords(targetStudentId).catch(() => []),
          academicsService.getStudentExamResults(targetStudentId).catch(() => []),
          materialsService.getStudyMaterials(targetStudent.batch_id).catch(() => ({ data: [] })),
          timetableService.getTimetable(targetStudent.batch_id).catch(() => ({ data: [] })),
          diaryService.getClassSessions(targetStudent.batch_id).catch(() => ({ data: [] })),
          announcementsService.getAnnouncements(targetStudent.batch_id).catch(() => ({ data: [] })),
          diaryService.getStudentGamification(targetStudentId).catch(() => ({ streak: null, badges: [], points: [], totalPoints: 0 })),
          diaryService.getStudentCertificates(targetStudentId).catch(() => []),
        ]);

        if (statsRes) setAttendanceStats(statsRes);
        setRecentLogs(logsRes);
        setFeeRecords(feesRes);
        setExamResults(examsRes);
        setMaterials(matRes.data);
        setTimetable(timeRes.data);
        setClassSessions(sessionsRes.data || []);
        setAnnouncements(annRes.data || []);
        setGamification(gamifyRes);
        setCertificates(certRes);
      }
    } catch (err) {
      console.error("Error loading student portal data:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayName = studentInfo?.full_name || user?.full_name || "Student";
  const admissionNo = studentInfo?.admission_no || "PC-2026-0001";
  const batchName = studentInfo?.batch_name || "Class 10 Science";

  const totalSessions = attendanceStats?.total_sessions ?? 0;
  const attendedSessions = attendanceStats?.attended_sessions ?? 0;
  const attendanceRate = attendanceStats?.percentage ?? 100;
  const isDefaulter = attendanceStats?.is_defaulter ?? false;

  const currentDayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date().getDay()];

  const todayClasses = timetable
    .filter((t) => t.day_of_week.toLowerCase() === currentDayName.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Fee calculation
  const totalFeeBilled = feeRecords.reduce((acc, r) => acc + r.amount, 0);
  const totalFeePaid = feeRecords.reduce((acc, r) => acc + r.paid_amount, 0);
  const totalFeeDue = Math.max(0, totalFeeBilled - totalFeePaid);

  const handleOpenReceipt = (rec: FeeRecord) => {
    setActiveReceipt({
      receipt_no: rec.receipt_no || "REC-2026-0000",
      student_name: studentInfo?.full_name || "Student",
      admission_no: studentInfo?.admission_no || "PC-2026-XXXX",
      batch_name: studentInfo?.batch_name || "Batch",
      title: rec.title,
      amount_paid: rec.paid_amount,
      total_amount: rec.amount,
      balance_due: rec.balance_due,
      payment_mode: rec.payment_mode || "UPI",
      transaction_ref: rec.transaction_ref,
      payment_date: rec.paid_date || new Date().toISOString(),
      notes: rec.notes,
    });
  };

  if (loading) {
    return <LoadingSpinner label="Loading your academic portal..." size="lg" />;
  }

  if (!studentInfo) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm my-8">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <GraduationCap size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">Student Account Not Linked</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Your portal login account ({user?.email}) is not yet linked to an active student admission record.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Please contact Pradeep Classes administration to connect your student admission number with this account.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/settings"
            className="px-4 py-2 bg-[#102f50] text-white text-xs font-bold rounded-lg hover:bg-[#16466f] transition"
          >
            View Account Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Banner */}
      <div className="bg-gradient-to-r from-[#102f50] to-[#1d5284] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#f4b942] font-extrabold">
            STUDENT ACADEMIC PORTAL
          </div>
          <h1 className="text-2xl font-extrabold mt-1 tracking-tight">{displayName}</h1>
          <p className="text-xs text-slate-300 mt-1 flex items-center gap-3">
            <span>Admission No: <strong className="text-white font-mono">{admissionNo}</strong></span>
            <span>•</span>
            <span>Batch: <strong className="text-white">{batchName}</strong></span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {gamification.streak && gamification.streak.current_attendance_streak > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-400 text-orange-200 text-xs font-extrabold flex items-center gap-1.5">
              <Flame size={15} className="text-orange-400 animate-pulse" />
              <span>{gamification.streak.current_attendance_streak} Day Streak!</span>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <Sparkles size={15} />
            <span>{gamification.totalPoints} Learning Points</span>
          </div>

          <Link
            to="/settings"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Settings size={14} />
            <span>My Profile</span>
          </Link>

          {isDefaulter && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400 text-rose-200 text-xs font-bold flex items-center gap-1.5">
              <ShieldAlert size={15} />
              <span>Attendance Warning: Below 75%</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Home size={16} />
          Daily Home
        </button>

        <button
          onClick={() => setActiveTab("homework")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "homework"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookCheck size={16} />
          Homework & Lessons ({classSessions.length})
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "attendance"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardCheck size={16} />
          Attendance ({attendanceRate.toFixed(1)}%)
        </button>

        <button
          onClick={() => setActiveTab("exams")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "exams"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Award size={16} />
          Exams & Report Cards ({examResults.length})
        </button>

        <button
          onClick={() => setActiveTab("fees")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "fees"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <IndianRupee size={16} />
          Fee Ledger & Receipts
        </button>

        <button
          onClick={() => setActiveTab("materials")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "materials"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FolderDown size={16} />
          Study Materials ({materials.length})
        </button>

        <button
          onClick={() => setActiveTab("timetable")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "timetable"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock size={16} />
          Class Timetable
        </button>

        <button
          onClick={() => setActiveTab("gamification")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "gamification"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Trophy size={16} />
          Badges & Streaks ({gamification.badges.length})
        </button>

        <button
          onClick={() => setActiveTab("certificates")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "certificates"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCheck2 size={16} />
          Certificates ({certificates.length})
        </button>
      </div>

      {/* Tab: Overview (Daily Home) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Attendance Compliance"
              value={`${attendanceRate.toFixed(0)}%`}
              delta={isDefaulter ? "Action Needed" : "Compliant"}
              note={`${attendedSessions} of ${totalSessions} lectures`}
              icon={ClipboardCheck}
              tone={isDefaulter ? "rose" : "green"}
            />
            <StatCard
              title="Study Streak"
              value={`${gamification.streak?.current_attendance_streak || 0} Days`}
              note="Consecutive active days"
              icon={Flame}
              tone="amber"
            />
            <StatCard
              title="Exams Evaluated"
              value={String(examResults.length)}
              note="Assessment tests recorded"
              icon={Award}
              tone="violet"
            />
            <StatCard
              title="Outstanding Dues"
              value={`₹${totalFeeDue.toLocaleString()}`}
              note={totalFeeDue > 0 ? "Pending payment" : "All cleared"}
              icon={IndianRupee}
              tone={totalFeeDue > 0 ? "amber" : "blue"}
            />
          </div>

          {/* Today's Schedule & Notice Board */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Classes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="text-[#16466f]" size={18} />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Today's Classes ({currentDayName})
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab("timetable")}
                  className="text-xs font-bold text-[#16466f] hover:underline"
                >
                  Full Week →
                </button>
              </div>

              {todayClasses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No classes scheduled for your batch today. Perfect time for revision & homework!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayClasses.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{item.subject}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {item.teacher_name || "Faculty"} • {item.room_number || "Room 101"}
                        </div>
                      </div>
                      <Badge variant="blue" size="sm">
                        {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Institute Announcements */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="text-[#16466f]" size={18} />
                  <h3 className="font-bold text-slate-800 text-sm">Notice Board & Broadcasts</h3>
                </div>
                <Badge variant="neutral" size="sm">
                  {announcements.length} Notices
                </Badge>
              </div>

              {announcements.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No announcements broadcasted yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {announcements.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900">{a.title}</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {a.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Homework & Class Diary Lessons */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Recent Class Lectures & Assigned Homework</h3>
                <p className="text-xs text-slate-500">Official class diary entries submitted by your faculty</p>
              </div>
              <button
                onClick={() => setActiveTab("homework")}
                className="text-xs font-bold text-[#16466f] hover:underline"
              >
                View All Diaries ({classSessions.length}) →
              </button>
            </div>

            {classSessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No class diary records submitted yet for this batch.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classSessions.slice(0, 4).map((sess) => (
                  <div
                    key={sess.id}
                    className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-bold text-[#16466f]">{sess.subject}</span>
                        <span className="text-slate-400 text-[11px]">{sess.session_date}</span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {sess.diary?.chapter_name || "Conducted Lecture"}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        <b>Topics:</b> {sess.diary?.topics_covered || "Classroom lecture completed."}
                      </p>
                    </div>

                    {sess.diary?.homework_notes && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                        <span className="font-bold block text-[10px] uppercase text-amber-700">Homework Assigned:</span>
                        <p className="mt-0.5 leading-snug">{sess.diary.homework_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Homework & Class Diary */}
      {activeTab === "homework" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base">All Class Diary Entries & Homework</h3>
              <p className="text-xs text-slate-500">
                Track every lecture taught, topics covered, and assigned homework in your batch.
              </p>
            </div>

            {classSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                No class diary sessions found for your batch.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {classSessions.map((sess) => (
                  <div key={sess.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#16466f] text-sm">{sess.subject}</span>
                        <Badge variant="blue" size="sm">{sess.teacher_name}</Badge>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{sess.session_date}</span>
                    </div>

                    {sess.diary ? (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
                        <div>
                          <b className="text-slate-800">Chapter: </b>
                          <span className="text-slate-700">{sess.diary.chapter_name || "Standard Chapter"}</span>
                        </div>
                        <div>
                          <b className="text-slate-800">Topics Covered: </b>
                          <span className="text-slate-600">{sess.diary.topics_covered || "Lecture delivered"}</span>
                        </div>
                        {sess.diary.teaching_remarks && (
                          <div>
                            <b className="text-slate-800">Teacher Remarks: </b>
                            <span className="text-slate-500 italic">{sess.diary.teaching_remarks}</span>
                          </div>
                        )}
                        {sess.diary.homework_notes && (
                          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-amber-900">
                            <b className="text-amber-800 block text-[11px] uppercase tracking-wide">
                              Assigned Homework:
                            </b>
                            <p className="mt-0.5">{sess.diary.homework_notes}</p>
                          </div>
                        )}
                        {sess.diary.next_planned_topic && (
                          <div className="text-[11px] text-slate-500 pt-1">
                            <b>Next Planned Topic: </b> {sess.diary.next_planned_topic}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Lecture conducted; awaiting diary submission by faculty.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Attendance */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Attendance Ratio"
              value={`${attendanceRate.toFixed(1)}%`}
              delta={isDefaulter ? "Action Required" : "Compliant"}
              note={`${attendedSessions} of ${totalSessions} sessions attended`}
              icon={ClipboardCheck}
              tone={isDefaulter ? "rose" : "green"}
            />
            <StatCard
              title="Attended Sessions"
              value={String(attendedSessions)}
              note="Total days marked present"
              icon={CheckCircle2}
              tone="blue"
            />
            <StatCard
              title="Absence Count"
              value={String(Math.max(0, totalSessions - attendedSessions))}
              note="Missed classroom lectures"
              icon={AlertCircle}
              tone={isDefaulter ? "rose" : "amber"}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-base mb-4">Recent Daily Attendance Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Batch</th>
                    <th className="py-2.5 px-4">Attendance Status</th>
                    <th className="py-2.5 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                        No recent attendance records logged.
                      </td>
                    </tr>
                  ) : (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{log.session_date}</td>
                        <td className="py-3 px-4 text-slate-600">{log.batch_name}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              log.status === "present"
                                ? "green"
                                : log.status === "late"
                                ? "amber"
                                : "red"
                            }
                            size="sm"
                          >
                            {log.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{log.note || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Exams */}
      {activeTab === "exams" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Published Exam Results & Scorecards</h3>
            <p className="text-xs text-slate-500 mb-4">Official grades and performance marks authorized by institute faculty.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Exam</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Marks Scored</th>
                    <th className="py-3 px-4 text-right">Percentage</th>
                    <th className="py-3 px-4 text-center">Grade</th>
                    <th className="py-3 px-4 text-center">Batch Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        No published exam results available at this time.
                      </td>
                    </tr>
                  ) : (
                    examResults.map((res) => (
                      <tr key={res.exam_id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">{res.exam_title}</td>
                        <td className="py-3 px-4 text-slate-600">{res.subject}</td>
                        <td className="py-3 px-4 text-slate-500">{res.exam_date}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {res.is_absent ? "ABS" : `${res.marks_obtained} / ${res.total_marks}`}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {res.is_absent ? "0.0%" : `${res.percentage.toFixed(1)}%`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={
                              res.is_absent
                                ? "red"
                                : res.grade === "A+" || res.grade === "A"
                                ? "green"
                                : res.grade === "B" || res.grade === "C"
                                ? "blue"
                                : "red"
                            }
                            size="sm"
                          >
                            {res.grade}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {res.rank ? `#${res.rank}` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Fees */}
      {activeTab === "fees" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Billed"
              value={`₹${totalFeeBilled.toLocaleString()}`}
              note="Gross fee amount"
              icon={IndianRupee}
              tone="blue"
            />
            <StatCard
              title="Total Paid"
              value={`₹${totalFeePaid.toLocaleString()}`}
              note="Settled installments"
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              title="Outstanding Balance"
              value={`₹${totalFeeDue.toLocaleString()}`}
              note={totalFeeDue === 0 ? "All fees settled" : "Due for payment"}
              icon={AlertCircle}
              tone={totalFeeDue > 0 ? "rose" : "green"}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-base mb-4">Official Invoices & Receipts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Receipt / Invoice</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Total (INR)</th>
                    <th className="py-3 px-4 text-right">Paid (INR)</th>
                    <th className="py-3 px-4 text-right">Due (INR)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        No fee invoices recorded for your account.
                      </td>
                    </tr>
                  ) : (
                    feeRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {r.receipt_no || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{r.title}</td>
                        <td className="py-3 px-4 text-right font-medium">₹{r.amount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">₹{r.paid_amount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">₹{r.balance_due.toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={
                              r.status === "paid"
                                ? "green"
                                : r.status === "partial"
                                ? "amber"
                                : "red"
                            }
                            size="sm"
                          >
                            {r.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.paid_amount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Printer size={13} />}
                              onClick={() => handleOpenReceipt(r)}
                            >
                              Receipt
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Study Materials */}
      {activeTab === "materials" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200">
              <FolderDown size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-700">No study materials available yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Faculty will upload chapter notes and formula sheets for your batch here.
              </p>
            </div>
          ) : (
            materials.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="blue" size="sm">
                      {m.subject}
                    </Badge>
                    <span className="text-[11px] font-semibold uppercase text-slate-400">
                      {m.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{m.title}</h3>
                  {m.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {m.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16466f] hover:underline"
                  >
                    <Download size={13} /> Download
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 5: Timetable */}
      {activeTab === "timetable" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 text-base mb-1">Weekly Class Schedule</h3>
          <p className="text-xs text-slate-500 mb-6">Class timings and room allocations for {batchName}.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timetable.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic">
                No scheduled classes for your batch this week.
              </div>
            ) : (
              timetable.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-[#16466f]/40 transition shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="blue" size="sm">
                      {item.day_of_week}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-[#16466f]">
                      {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{item.subject}</h4>

                  <div className="mt-3 pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                    {item.teacher_name && <div>Faculty: <b>{item.teacher_name}</b></div>}
                    {item.room_number && <div>Room: <b>{item.room_number}</b></div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Gamification */}
      {activeTab === "gamification" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Attendance Streak"
              value={`${gamification.streak?.current_attendance_streak || 0} Days`}
              icon={Flame}
              note={`Personal Best: ${gamification.streak?.longest_attendance_streak || 0} Days`}
              tone="amber"
            />
            <StatCard
              title="Badges Unlocked"
              value={gamification.badges.length}
              icon={Trophy}
              note="Academic Milestones"
              tone="amber"
            />
            <StatCard
              title="Total Learning Points"
              value={gamification.totalPoints}
              icon={Sparkles}
              note="Redeemable Rewards"
              tone="violet"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Earned Badges & Achievements</h3>
            <p className="text-xs text-slate-500 mb-6">Punctuality, test performance, and academic consistency awards.</p>

            {gamification.badges.length === 0 ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                No badges unlocked yet. Maintain 100% weekly attendance or score A+ in exams to earn badges!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {gamification.badges.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                      🏆
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{b.badge_name}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">{b.description}</p>
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        Earned: {new Date(b.earned_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Points Ledger */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Points Activity Ledger</h3>
            <p className="text-xs text-slate-500 mb-4">Chronological record of points earned for attendance, homework, and test scores.</p>

            {gamification.points.length === 0 ? (
              <div className="py-6 text-center text-slate-400 italic text-xs">
                No points activities recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {gamification.points.map((p) => (
                  <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{p.reason}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(p.created_at).toLocaleDateString()} • {p.event_type}
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      +{p.points} PTS
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Certificates */}
      {activeTab === "certificates" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-1">Official Certificates & Credentials</h3>
          <p className="text-xs text-slate-500 mb-6">Cryptographically signed and verified certificates issued by Pradeep Classes.</p>

          {certificates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic text-xs">
              No certificates issued yet. Certificates are published after course completion or milestone tests.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificates.map((c) => (
                <div key={c.id} className="border-2 border-slate-200 rounded-xl p-5 bg-gradient-to-br from-slate-50 to-white relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#16466f] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {c.certificate_type.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      #{c.certificate_no}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-[#102f50] text-base">{c.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">Course: <b>{c.course_name}</b></p>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-400 text-[11px]">
                      Issued: {new Date(c.issue_date).toLocaleDateString()}
                    </span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                      <CheckCircle2 size={13} /> Verified Authentic
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <PrintableReceiptModal
          isOpen={!!activeReceipt}
          onClose={() => setActiveReceipt(null)}
          receipt={activeReceipt}
        />
      )}
    </div>
  );
};
