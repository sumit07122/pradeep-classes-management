import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  User,
  BookmarkCheck,
  FileText,
  TrendingUp,
  Edit2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button, Input, Badge, LoadingSpinner, AlertNotice, Modal, StatCard } from "../components/common";
import { diaryService } from "../services/diaryService";
import { batchesService } from "../services/batchesService";
import { useAuth } from "../hooks/useAuth";
import type { ClassSession, CreateClassDiaryDTO, SyllabusChapter } from "../types/diary";
import type { Batch } from "../types";

export const ClassDiary: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<"diary" | "syllabus">("diary");
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [syllabus, setSyllabus] = useState<SyllabusChapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: Record / Edit Class Diary
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<ClassSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formBatchId, setFormBatchId] = useState("");
  const [formSubject, setFormSubject] = useState("Physics");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:30");
  const [formDuration, setFormDuration] = useState(90);
  const [formChapter, setFormChapter] = useState("");
  const [formTopics, setFormTopics] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formHomework, setFormHomework] = useState("");
  const [formNextTopic, setFormNextTopic] = useState("");

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isStaff = ["super_admin", "owner", "admin", "teacher"].includes(role);
  const canDelete = ["super_admin", "owner", "admin"].includes(role);
  const canEdit = canDelete || role === "teacher";

  useEffect(() => {
    loadBatchesAndData();
  }, [selectedBatchId]);

  const loadBatchesAndData = async () => {
    setLoading(true);
    try {
      const [bRes, sessRes, sylRes] = await Promise.all([
        batchesService.getBatches(),
        diaryService.getClassSessions(selectedBatchId),
        diaryService.getSyllabusWithProgress(selectedBatchId),
      ]);

      const bList = bRes.data || [];
      setBatches(bList);
      if (bList.length > 0 && !formBatchId) {
        setFormBatchId(bList[0].id);
      }
      setSessions(sessRes.data);
      setSyllabus(sylRes.data);
    } catch (err: any) {
      setNotice({ type: "error", message: err.message || "Failed to load class diary." });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingSession(null);
    if (batches.length > 0) setFormBatchId(batches[0].id);
    setFormSubject("Physics");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormStartTime("09:00");
    setFormEndTime("10:30");
    setFormDuration(90);
    setFormChapter("");
    setFormTopics("");
    setFormRemarks("");
    setFormHomework("");
    setFormNextTopic("");
    setIsRecordModalOpen(true);
  };

  const handleOpenEdit = (sess: ClassSession) => {
    setEditingSession(sess);
    setFormBatchId(sess.batch_id);
    setFormSubject(sess.subject);
    setFormDate(sess.session_date);
    setFormStartTime(sess.start_time);
    setFormEndTime(sess.end_time);
    setFormDuration(sess.actual_duration_minutes || 90);
    setFormChapter(sess.diary?.chapter_name || "");
    setFormTopics(sess.diary?.topics_covered || "");
    setFormRemarks(sess.diary?.teaching_remarks || "");
    setFormHomework(sess.diary?.homework_notes || "");
    setFormNextTopic(sess.diary?.next_planned_topic || "");
    setIsRecordModalOpen(true);
  };

  const handleSaveDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBatchId || !formChapter.trim() || !formTopics.trim()) {
      setNotice({ type: "error", message: "Batch, Chapter, and Topics covered are mandatory." });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const dto: CreateClassDiaryDTO = {
      batch_id: formBatchId,
      subject: formSubject,
      session_date: formDate,
      start_time: formStartTime,
      end_time: formEndTime,
      actual_duration_minutes: Number(formDuration),
      chapter_name: formChapter,
      topics_covered: formTopics,
      teaching_remarks: formRemarks,
      homework_notes: formHomework,
      next_planned_topic: formNextTopic,
    };

    let res: { success: boolean; error?: string };
    if (editingSession) {
      res = await diaryService.updateClassDiary(editingSession.id, editingSession.diary?.id, dto);
    } else {
      res = await diaryService.submitClassDiary(dto);
    }

    setIsSubmitting(false);

    if (!res.success) {
      setNotice({ type: "error", message: res.error || "Failed to save diary." });
    } else {
      setNotice({
        type: "success",
        message: editingSession
          ? "Class Diary updated successfully!"
          : "Class Diary recorded successfully!",
      });
      setIsRecordModalOpen(false);
      setEditingSession(null);
      loadBatchesAndData();
    }
  };

  const handleDeleteDiary = async () => {
    if (!deletingSession) return;
    setIsSubmitting(true);
    setNotice(null);

    const res = await diaryService.deleteClassDiary(deletingSession.id);
    setIsSubmitting(false);

    if (!res.success) {
      setNotice({ type: "error", message: res.error || "Failed to delete diary record." });
    } else {
      setNotice({ type: "success", message: "Class diary and lecture record deleted." });
      setDeletingSession(null);
      loadBatchesAndData();
    }
  };

  const handleToggleTopicStatus = async (topicId: string, currentStatus: string) => {
    if (!isStaff || selectedBatchId === "all") return;
    const newStatus = currentStatus === "completed" ? "in_progress" : "completed";
    await diaryService.updateTopicProgress(selectedBatchId, topicId, newStatus);
    const updatedSyl = await diaryService.getSyllabusWithProgress(selectedBatchId);
    setSyllabus(updatedSyl.data);
  };

  // Calculate syllabus stats
  const allTopics = syllabus.flatMap((ch) => ch.topics || []);
  const completedTopics = allTopics.filter((t) => t.status === "completed").length;
  const progressPct = allTopics.length > 0 ? Math.round((completedTopics / allTopics.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="eyebrow">ACADEMIC WORKFLOW & LESSON AUDIT</div>
          <h1 className="text-2xl font-black text-[#102f50] font-['Manrope']">
            Class Diary & Syllabus Progress
          </h1>
          <p className="text-xs text-slate-500">
            Mandatory post-lecture lesson tracking, chapter coverage, and syllabus completion monitoring.
          </p>
        </div>

        {/* Batch Filter Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#16466f]"
          >
            <option value="all">All Institute Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.course_name})
              </option>
            ))}
          </select>

          {isStaff && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
              icon={<Plus size={15} />}
            >
              Record Class Diary
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <AlertNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Lectures Conducted"
          value={String(sessions.length)}
          icon={BookOpen}
          note="Recorded in Log"
          tone="blue"
        />
        <StatCard
          title="Overall Syllabus Completed"
          value={`${progressPct}%`}
          icon={TrendingUp}
          note={`${completedTopics} of ${allTopics.length} topics done`}
          tone="green"
        />
        <StatCard
          title="Teaching Hours Logged"
          value={`${Math.round(
            sessions.reduce((acc, s) => acc + (s.actual_duration_minutes || 90), 0) / 60
          )} hrs`}
          icon={Clock}
          note="Actual classroom instruction"
          tone="violet"
        />
        <StatCard
          title="Faculty Diary Compliance"
          value="100%"
          icon={BookmarkCheck}
          note="Audited daily"
          tone="amber"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("diary")}
          className={`flex items-center gap-2 pb-3 font-bold text-xs uppercase tracking-wider transition ${
            activeTab === "diary"
              ? "border-b-2 border-[#16466f] text-[#16466f]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={15} />
          Conducted Lectures & Diary Log ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab("syllabus")}
          className={`flex items-center gap-2 pb-3 font-bold text-xs uppercase tracking-wider transition ${
            activeTab === "syllabus"
              ? "border-b-2 border-[#16466f] text-[#16466f]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookmarkCheck size={15} />
          Curriculum & Syllabus Progress Tracker ({syllabus.length} Chapters)
        </button>
      </div>

      {/* Tab 1: Conducted Lectures Diary Log */}
      {activeTab === "diary" && (
        <div className="space-y-4">
          {loading ? (
            <LoadingSpinner label="Loading class diary..." size="md" />
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <BookOpen size={40} className="mx-auto text-slate-400 mb-3" />
              <h3 className="font-bold text-slate-700 text-base">No Lecture Diaries Recorded</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Faculty can click "Record Class Diary" after every lecture to log topics taught, homework, and observations.
              </p>
              {isStaff && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreate}
                  icon={<Plus size={14} />}
                >
                  Record First Class Diary
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-[#16466f]/40 transition space-y-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="blue" size="sm">
                          {sess.subject}
                        </Badge>
                        <span className="text-xs font-bold text-slate-800">{sess.batch_name}</span>
                      </div>
                      <h4 className="font-extrabold text-[#102f50] text-base mt-1.5">
                        {sess.diary?.chapter_name || "General Lecture"}
                      </h4>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 mb-1">
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEdit(sess)}
                            className="p-1 text-slate-400 hover:text-[#16466f] transition"
                            title="Edit Class Diary"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeletingSession(sess)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Delete Class Diary"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-700 flex items-center justify-end gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {new Date(sess.session_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1 mt-0.5">
                        <Clock size={11} className="text-slate-400" />
                        {sess.start_time} - {sess.end_time} ({sess.actual_duration_minutes}m)
                      </div>
                    </div>
                  </div>

                  {/* Topics Covered */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-700">
                    <span className="font-bold text-[#16466f] block mb-1">Topics Taught:</span>
                    <p className="whitespace-pre-line leading-relaxed">
                      {sess.diary?.topics_covered || "Topics not specified"}
                    </p>
                  </div>

                  {/* Homework / Remarks */}
                  {(sess.diary?.homework_notes || sess.diary?.teaching_remarks) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {sess.diary?.homework_notes && (
                        <div className="bg-amber-50/70 border border-amber-200/60 p-2.5 rounded-lg text-amber-900">
                          <span className="font-bold block mb-0.5">📝 Homework Assigned:</span>
                          <p>{sess.diary.homework_notes}</p>
                        </div>
                      )}
                      {sess.diary?.teaching_remarks && (
                        <div className="bg-indigo-50/70 border border-indigo-200/60 p-2.5 rounded-lg text-indigo-900">
                          <span className="font-bold block mb-0.5">💡 Teaching Observation:</span>
                          <p>{sess.diary.teaching_remarks}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      Faculty: <b className="text-slate-700">{sess.teacher_name}</b>
                    </span>
                    {sess.diary?.next_planned_topic && (
                      <span className="text-teal-700 font-semibold truncate max-w-[200px]">
                        Next: {sess.diary.next_planned_topic}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Syllabus Progress Tracker */}
      {activeTab === "syllabus" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Curriculum & Chapters</h3>
                <p className="text-xs text-slate-500">
                  {selectedBatchId === "all"
                    ? "Select a specific batch from the top dropdown to update topic completion."
                    : "Click any topic to mark it as Completed or In Progress for this batch."}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full sm:w-64 bg-slate-100 rounded-full h-3.5 p-0.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {syllabus.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic">
                No syllabus chapters configured for this course.
              </div>
            ) : (
              <div className="space-y-4">
                {syllabus.map((ch) => {
                  const chCompleted = (ch.topics || []).filter((t) => t.status === "completed").length;
                  const totalTopics = ch.topics?.length || 0;
                  const chPct = totalTopics > 0 ? Math.round((chCompleted / totalTopics) * 100) : 0;

                  return (
                    <div
                      key={ch.id}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#16466f] text-white text-[10px] font-bold rounded">
                            Ch {ch.chapter_no}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{ch.title}</h4>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                          <span>
                            {chCompleted}/{totalTopics} Topics
                          </span>
                          <Badge variant={chPct === 100 ? "green" : chPct > 0 ? "blue" : "neutral"}>
                            {chPct}% Done
                          </Badge>
                        </div>
                      </div>

                      {/* Topics List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
                        {(ch.topics || []).map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleToggleTopicStatus(t.id, t.status || "not_started")}
                            className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition ${
                              isStaff && selectedBatchId !== "all"
                                ? "cursor-pointer hover:shadow-sm"
                                : ""
                            } ${
                              t.status === "completed"
                                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                                : t.status === "in_progress"
                                ? "bg-blue-50/80 border-blue-200 text-blue-900"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            <span className="mt-0.5">
                              {t.status === "completed" ? (
                                <CheckCircle2 size={14} className="text-emerald-600" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-400" />
                              )}
                            </span>
                            <div>
                              <p className="font-semibold">{t.title}</p>
                              {t.completed_on && (
                                <span className="text-[10px] text-emerald-700 block">
                                  Done {new Date(t.completed_on).toLocaleDateString("en-IN")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record / Edit Class Diary Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingSession(null);
        }}
        title={editingSession ? "Edit Lecture Diary" : "Record Daily Class Diary"}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveDiary} className="space-y-4">
          <p className="text-xs text-slate-500">
            {editingSession
              ? "Update lesson log details, topics taught, and homework assignments."
              : "Submit official lesson log for today's lecture. This updates the student timeline and academic audit register."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Batch *</label>
              <select
                value={formBatchId}
                onChange={(e) => setFormBatchId(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-[#16466f]"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.course_name})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Subject *"
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              placeholder="e.g. Physics / Mathematics / Chemistry"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input
              label="Class Date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
            <Input
              label="Start Time"
              type="time"
              value={formStartTime}
              onChange={(e) => setFormStartTime(e.target.value)}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={formEndTime}
              onChange={(e) => setFormEndTime(e.target.value)}
              required
            />
            <Input
              label="Duration (Mins)"
              type="number"
              value={formDuration}
              onChange={(e) => setFormDuration(Number(e.target.value))}
              required
            />
          </div>

          <Input
            label="Chapter Name *"
            placeholder="e.g. Chapter 3: Laws of Motion & Friction"
            value={formChapter}
            onChange={(e) => setFormChapter(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Detailed Topics Covered *
            </label>
            <textarea
              rows={3}
              value={formTopics}
              onChange={(e) => setFormTopics(e.target.value)}
              placeholder="List specific derivations, problem types, or concepts taught in this lecture..."
              required
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#16466f] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Homework Given</label>
              <textarea
                rows={2}
                value={formHomework}
                onChange={(e) => setFormHomework(e.target.value)}
                placeholder="e.g. Exercise 3.2 Q1 to Q10 in module book..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#16466f] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Next Planned Topic</label>
              <textarea
                rows={2}
                value={formNextTopic}
                onChange={(e) => setFormNextTopic(e.target.value)}
                placeholder="e.g. Static vs Kinetic friction problems..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#16466f] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Faculty Remarks / Student Comprehension
            </label>
            <input
              type="text"
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Students understood normal force well; numerical practice needed on inclined plane."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#16466f] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsRecordModalOpen(false);
                setEditingSession(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {editingSession ? "Save Changes" : "Submit Class Diary"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Diary Confirmation Modal */}
      {deletingSession && (
        <Modal
          isOpen={!!deletingSession}
          onClose={() => setDeletingSession(null)}
          title="Delete Class Diary & Session"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm text-rose-900">
                  Delete lecture record for {deletingSession.diary?.chapter_name || deletingSession.subject}?
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Date: {new Date(deletingSession.session_date).toLocaleDateString("en-IN")} • Batch: {deletingSession.batch_name}<br />
                  This will permanently delete this class session and all associated topics, homework notes, and teacher remarks.
                </p>
              </div>
            </div>

            <div className="modal-actions pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingSession(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isSubmitting}
                onClick={handleDeleteDiary}
                icon={<Trash2 size={15} />}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
