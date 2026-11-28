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
  ShieldCheck,
  Camera,
  Flame,
  Trophy,
  FileCheck2,
  Sparkles,
  Settings,
  GraduationCap,
  Home,
  Bell,
  BookCheck,
  FileText,
  HelpCircle,
  Send,
  Upload,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { StatCard, Badge, LoadingSpinner, Button, AlertNotice, Modal } from "../components/common";
import { StudentPhotoUploadModal } from "../components/portal/StudentPhotoUploadModal";
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
import type { StudyMaterial, Homework, StudentDoubt, HomeworkSubmission } from "../types/materials";
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
    | "documents"
    | "doubts"
  >("overview");

  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    full_name: string;
    admission_no: string;
    batch_id: string;
    batch_name: string;
    course_name: string;
    photo_url?: string | null;
    is_profile_locked?: boolean;
    phone?: string;
  } | null>(null);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

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

  // Documents Vault
  const [studentDocs, setStudentDocs] = useState<any[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("identity_proof");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Doubt Desk
  const [doubts, setDoubts] = useState<StudentDoubt[]>([]);
  const [doubtSubject, setDoubtSubject] = useState("Physics");
  const [doubtTopic, setDoubtTopic] = useState("");
  const [doubtQuestion, setDoubtQuestion] = useState("");
  const [isSubmittingDoubt, setIsSubmittingDoubt] = useState(false);

  // Homework Submissions
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [activeHwToSubmit, setActiveHwToSubmit] = useState<Homework | null>(null);
  const [hwSubmissionText, setHwSubmissionText] = useState("");
  const [isSubmittingHw, setIsSubmittingHw] = useState(false);

  const [portalNotice, setPortalNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
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
        .select("id, full_name, admission_no, batch_id, photo_url, is_profile_locked, phone, batches(name, course_name)")
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
          photo_url: targetStudent.photo_url || null,
          is_profile_locked: Boolean(targetStudent.is_profile_locked),
          phone: targetStudent.phone,
        });

        // Parallel fetch for attendance, fees, exams, materials, timetable, sessions, announcements, gamification, certificates, documents, doubts, homework
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
          docsRes,
          doubtsRes,
          hwRes,
          subsRes,
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
          supabase.from("student_documents").select("*").eq("student_id", targetStudentId).order("created_at", { ascending: false }),
          materialsService.getStudentDoubts(targetStudentId).catch(() => ({ data: [] })),
          materialsService.getHomework(targetStudent.batch_id).catch(() => ({ data: [] })),
          materialsService.getHomeworkSubmissions(undefined, targetStudentId).catch(() => ({ data: [] })),
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
        setStudentDocs(docsRes?.data || []);
        setDoubts(doubtsRes.data || []);
        setHomeworkList(hwRes.data || []);

        const subMap: Record<string, HomeworkSubmission> = {};
        (subsRes.data || []).forEach((s) => {
          subMap[s.homework_id] = s;
        });
        setSubmissions(subMap);
      }
    } catch (err) {
      console.error("Error loading student portal data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadStudentDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInfo || !docFile || !docTitle.trim() || !supabase) return;

    setIsUploadingDoc(true);
    setPortalNotice(null);
    try {
      const ext = docFile.name.split(".").pop();
      const filePath = `${studentInfo.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("student-documents")
        .upload(filePath, docFile);

      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("student_documents").insert({
        institute_id: "11111111-2222-3333-4444-555555555555",
        student_id: studentInfo.id,
        document_type: docType,
        title: docTitle.trim(),
        file_url: filePath,
        is_verified: false,
      });

      if (insErr) throw insErr;

      setDocTitle("");
      setDocFile(null);
      setPortalNotice({ type: "success", message: "Document uploaded successfully to your vault." });
      
      const { data: updatedDocs } = await supabase
        .from("student_documents")
        .select("*")
        .eq("student_id", studentInfo.id)
        .order("created_at", { ascending: false });
      setStudentDocs(updatedDocs || []);
    } catch (err: any) {
      setPortalNotice({ type: "error", message: err.message || "Failed to upload document" });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDownloadStudentDoc = async (doc: any) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage
        .from("student-documents")
        .createSignedUrl(doc.file_url, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      alert("Failed to access document: " + err.message);
    }
  };

  const handleCreateDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInfo || !doubtQuestion.trim()) return;

    setIsSubmittingDoubt(true);
    setPortalNotice(null);
    try {
      const res = await materialsService.createStudentDoubt({
        student_id: studentInfo.id,
        batch_id: studentInfo.batch_id,
        subject: doubtSubject,
        topic: doubtTopic.trim() || undefined,
        question: doubtQuestion.trim(),
      });

      if (res.error) throw new Error(res.error);

      setDoubtQuestion("");
      setDoubtTopic("");
      setPortalNotice({ type: "success", message: "Doubt submitted to faculty. You will see their answer here." });

      const dRes = await materialsService.getStudentDoubts(studentInfo.id);
      setDoubts(dRes.data || []);
    } catch (err: any) {
      setPortalNotice({ type: "error", message: err.message || "Failed to submit doubt" });
    } finally {
      setIsSubmittingDoubt(false);
    }
  };

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInfo || !activeHwToSubmit || !hwSubmissionText.trim()) return;

    setIsSubmittingHw(true);
    setPortalNotice(null);
    try {
      const res = await materialsService.submitHomework({
        homework_id: activeHwToSubmit.id,
        student_id: studentInfo.id,
        submission_text: hwSubmissionText.trim(),
      });

      if (res.error) throw new Error(res.error);

      setPortalNotice({ type: "success", message: "Homework solution submitted successfully!" });
      setActiveHwToSubmit(null);
      setHwSubmissionText("");

      const subsRes = await materialsService.getHomeworkSubmissions(undefined, studentInfo.id);
      const subMap: Record<string, HomeworkSubmission> = {};
      (subsRes.data || []).forEach((s) => {
        subMap[s.homework_id] = s;
      });
      setSubmissions(subMap);
    } catch (err: any) {
      setPortalNotice({ type: "error", message: err.message || "Failed to submit homework" });
    } finally {
      setIsSubmittingHw(false);
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
      <div className="bg-gradient-to-r from-[#102f50] to-[#1d5284] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* Passport Photo Box */}
          {studentInfo.photo_url ? (
            <div className="relative w-20 h-24 rounded-xl overflow-hidden border-2 border-white/60 shadow-md shrink-0 bg-slate-800">
              <img
                src={studentInfo.photo_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-emerald-950/90 text-[8px] tracking-wider text-emerald-300 font-extrabold text-center py-0.5 flex items-center justify-center gap-0.5">
                <ShieldCheck size={9} />
                LOCKED
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsPhotoModalOpen(true)}
              className="w-20 h-24 rounded-xl border-2 border-dashed border-amber-300/80 bg-white/10 hover:bg-white/20 transition flex flex-col items-center justify-center text-center p-2 text-white shrink-0 group shadow-inner"
              title="Click to Upload Official Passport Photo"
            >
              <Camera size={22} className="text-amber-300 group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[9px] font-extrabold leading-tight text-amber-200">
                UPLOAD PHOTO
              </span>
            </button>
          )}

          <div>
            <div className="text-xs uppercase tracking-widest text-[#f4b942] font-extrabold">
              STUDENT ACADEMIC PORTAL
            </div>
            <h1 className="text-2xl font-extrabold mt-1 tracking-tight">{displayName}</h1>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
              <span>Admission No: <strong className="text-white font-mono">{admissionNo}</strong></span>
              <span>•</span>
              <span>Batch: <strong className="text-white">{batchName}</strong></span>
              {studentInfo.is_profile_locked && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded">
                    <ShieldCheck size={12} /> Identity Locked
                  </span>
                </>
              )}
            </p>
          </div>
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

        <button
          onClick={() => setActiveTab("documents")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "documents"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={16} />
          Document Vault ({studentDocs.length})
        </button>

        <button
          onClick={() => setActiveTab("doubts")}
          className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === "doubts"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HelpCircle size={16} />
          Doubt Desk ({doubts.length})
        </button>
      </div>

      {portalNotice && (
        <AlertNotice
          type={portalNotice.type}
          message={portalNotice.message}
          onDismiss={() => setPortalNotice(null)}
        />
      )}

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
          {/* Homework Assignments & Online Submissions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Homework Tasks & Submissions</h3>
                <p className="text-xs text-slate-500">
                  Submit your solutions online and view faculty grades and corrections.
                </p>
              </div>
              <Badge variant="blue" size="sm">{homeworkList.length} Tasks</Badge>
            </div>

            {homeworkList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No formal homework tasks assigned yet for your batch.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {homeworkList.map((hw) => {
                  const submission = submissions[hw.id];
                  return (
                    <div
                      key={hw.id}
                      className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-[#16466f]">{hw.subject || "General"}</span>
                          <span className="text-slate-400 font-mono text-[11px]">Due: {hw.due_date}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                        {hw.description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                            {hw.description}
                          </p>
                        )}
                        {hw.max_marks && (
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Max Marks: <b>{hw.max_marks}</b>
                          </span>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                        {submission ? (
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between text-xs">
                              <Badge
                                variant={
                                  submission.status === "graded"
                                    ? "success"
                                    : submission.status === "returned"
                                    ? "warning"
                                    : "blue"
                                }
                                size="sm"
                              >
                                {submission.status === "graded" ? `Graded: ${submission.grade}` : submission.status.toUpperCase()}
                              </Badge>
                              <span className="text-[10px] text-slate-400">
                                Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                              </span>
                            </div>
                            {submission.remarks && (
                              <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 italic">
                                <b>Faculty:</b> {submission.remarks}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Send size={13} />}
                            onClick={() => {
                              setActiveHwToSubmit(hw);
                              setHwSubmissionText("");
                            }}
                          >
                            Submit Solution
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base">All Class Diary Entries & Lectures</h3>
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

      {/* Tab 8: Documents Vault */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Upload Student Document</h3>
            <p className="text-xs text-slate-500 mb-4">
              Securely store identity proof, marksheets, and transfer certificates in your private vault.
            </p>

            <form onSubmit={handleUploadStudentDoc} className="space-y-3 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 10 Board Marksheet / Aadhar Card"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Category
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f] bg-white"
                  >
                    <option value="identity_proof">Identity Proof (Aadhar / PAN / Passport)</option>
                    <option value="address_proof">Address Proof</option>
                    <option value="marksheet">Academic Marksheet</option>
                    <option value="transfer_certificate">Transfer Certificate (TC)</option>
                    <option value="other">Other Official Document</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Attach File (PDF, PNG, JPG) *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUploadingDoc}
                  icon={<Upload size={13} />}
                >
                  Upload to Vault
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Your Verified Documents ({studentDocs.length})</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cryptographically stored records in Pradeep Classes private storage.
            </p>

            {studentDocs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-xs">
                No documents uploaded yet. Upload your admission documents above for administrative verification.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#16466f] flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{doc.title}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={doc.is_verified ? "success" : "neutral"} size="sm">
                        {doc.is_verified ? "Verified ✓" : "Pending Verification"}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleDownloadStudentDoc(doc)}
                        className="p-1.5 text-[#16466f] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition"
                        title="Download / View Signed Document"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 9: Doubt Desk */}
      {activeTab === "doubts" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Ask a Doubt / Academic Query</h3>
            <p className="text-xs text-slate-500 mb-4">
              Submit your academic questions directly to your batch subject faculties.
            </p>

            <form onSubmit={handleCreateDoubt} className="space-y-3 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject *
                  </label>
                  <select
                    value={doubtSubject}
                    onChange={(e) => setDoubtSubject(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f] bg-white"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="English">English</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chapter / Topic (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thermodynamics, Coordinate Geometry"
                    value={doubtTopic}
                    onChange={(e) => setDoubtTopic(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Question / Doubt Details *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain clearly what concept or problem step you need help with..."
                  value={doubtQuestion}
                  onChange={(e) => setDoubtQuestion(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
                />
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmittingDoubt}
                  icon={<Send size={13} />}
                >
                  Submit Academic Doubt
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-base mb-1">Your Submitted Doubts ({doubts.length})</h3>
            <p className="text-xs text-slate-500 mb-4">
              Real-time answers and resolutions from faculty members.
            </p>

            {doubts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-xs">
                You haven't submitted any doubts yet. Post any question above for faculty review.
              </div>
            ) : (
              <div className="space-y-4">
                {doubts.map((d) => (
                  <div
                    key={d.id}
                    className="p-5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="blue" size="sm">{d.subject}</Badge>
                        {d.topic && <span className="font-semibold text-slate-600">• {d.topic}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(d.created_at).toLocaleDateString()}
                        </span>
                        <Badge
                          variant={
                            d.status === "resolved"
                              ? "success"
                              : d.status === "in_review"
                              ? "blue"
                              : "warning"
                          }
                          size="sm"
                        >
                          {d.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{d.question}</h4>
                    </div>

                    {d.response ? (
                      <div className="mt-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-emerald-900 text-[11px]">
                          <span>Faculty Resolution / Answer:</span>
                          {d.responded_at && (
                            <span className="text-emerald-700 font-normal text-[10px]">
                              Answered {new Date(d.responded_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-emerald-900 leading-relaxed mt-1">{d.response}</p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic flex items-center gap-1.5 pt-1">
                        <Clock size={12} /> Assigned to batch faculty for review.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Homework Submission Modal */}
      {activeHwToSubmit && (
        <Modal
          isOpen={!!activeHwToSubmit}
          onClose={() => setActiveHwToSubmit(null)}
          title={`Submit Homework: ${activeHwToSubmit.title}`}
          subtitle={`Subject: ${activeHwToSubmit.subject || "General"} • Due Date: ${activeHwToSubmit.due_date}`}
        >
          <form onSubmit={handleSubmitHomework} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Solution / Explanations / Notes *
              </label>
              <textarea
                required
                rows={5}
                placeholder="Type your homework answers, key steps, or reference links here..."
                value={hwSubmissionText}
                onChange={(e) => setHwSubmissionText(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActiveHwToSubmit(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingHw}
                icon={<Send size={13} />}
              >
                Submit Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <PrintableReceiptModal
          isOpen={!!activeReceipt}
          onClose={() => setActiveReceipt(null)}
          receipt={activeReceipt}
        />
      )}

      {/* Student Passport Photo Upload & Lock Modal */}
      {isPhotoModalOpen && studentInfo && (
        <StudentPhotoUploadModal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          studentId={studentInfo.id}
          studentName={displayName}
          admissionNo={admissionNo}
          onSuccess={(photoUrl) => {
            setStudentInfo((prev) =>
              prev ? { ...prev, photo_url: photoUrl, is_profile_locked: true } : null
            );
            setPortalNotice({
              type: "success",
              message: "Passport photo uploaded successfully and identity profile is permanently locked.",
            });
          }}
        />
      )}
    </div>
  );
};
