import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Plus,
  Award,
  CheckCircle2,
  Share2,
  Lock,
} from "lucide-react";
import { Button, Input, Select, Badge, LoadingSpinner, AlertNotice, Modal } from "../components/common";
import { academicsService } from "../services/academicsService";
import { batchesService } from "../services/batchesService";
import { studentsService } from "../services/studentsService";
import { useAuth } from "../hooks/useAuth";
import type { Exam, ExamMark } from "../types/academics";
import type { Batch, Student } from "../types";

export const Academics: React.FC = () => {
  const { role } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMarksModalOpen, setIsMarksModalOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);

  const [marksStudents, setMarksStudents] = useState<Student[]>([]);
  const [studentMarksState, setStudentMarksState] = useState<{
    [studentId: string]: { marks_obtained: number; is_absent: boolean; remarks?: string };
  }>({});
  const [scorecardMarks, setScorecardMarks] = useState<ExamMark[]>([]);

  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Exam Form
  const [newExam, setNewExam] = useState({
    title: "",
    batch_id: "",
    subject: "",
    exam_date: new Date().toISOString().split("T")[0],
    total_marks: 100,
    passing_marks: 40,
  });

  useEffect(() => {
    loadData();
  }, [selectedBatchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const bFilter = selectedBatchId === "all" ? undefined : selectedBatchId;
      const [eRes, bRes] = await Promise.all([
        academicsService.getExams(bFilter),
        batchesService.getBatches(),
      ]);
      setExams(eRes.data);
      setBatches(bRes.data);

      if (bRes.data.length > 0 && !newExam.batch_id) {
        setNewExam((prev) => ({ ...prev, batch_id: bRes.data[0].id }));
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load examination data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.batch_id || !newExam.title || !newExam.subject) {
      setErrorNotice("Please fill in batch, title and subject.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    const res = await academicsService.createExam({
      title: newExam.title,
      batch_id: newExam.batch_id,
      subject: newExam.subject,
      exam_date: newExam.exam_date,
      total_marks: Number(newExam.total_marks),
      passing_marks: Number(newExam.passing_marks),
      exam_type: "unit_test",
      duration_minutes: 60,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Exam created successfully.");
      setIsCreateModalOpen(false);
      setNewExam({
        title: "",
        batch_id: batches[0]?.id || "",
        subject: "",
        exam_date: new Date().toISOString().split("T")[0],
        total_marks: 100,
        passing_marks: 40,
      });
      loadData();
    }
  };

  const openMarksEntry = async (exam: Exam) => {
    setActiveExam(exam);
    setErrorNotice(null);
    setLoading(true);

    try {
      // 1. Fetch students in the exam's batch
      const [studRes, marksRes] = await Promise.all([
        studentsService.getStudents(),
        academicsService.getExamMarks(exam.id),
      ]);

      const batchStudents = studRes.data.filter((s) => s.batch_id === exam.batch_id);
      setMarksStudents(batchStudents);

      // 2. Initialize marks state with existing marks if any
      const initial: { [key: string]: { marks_obtained: number; is_absent: boolean; remarks?: string } } = {};
      batchStudents.forEach((st) => {
        const found = marksRes.data.find((m) => m.student_id === st.id);
        initial[st.id] = {
          marks_obtained: found && found.marks_obtained !== null ? found.marks_obtained : 0,
          is_absent: found ? found.is_absent : false,
          remarks: found?.remarks || "",
        };
      });

      setStudentMarksState(initial);
      setIsMarksModalOpen(true);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load marks entry sheet.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMarks = async () => {
    if (!activeExam) return;

    setIsSubmitting(true);
    setErrorNotice(null);

    const payload = Object.entries(studentMarksState).map(([student_id, val]) => ({
      student_id,
      marks_obtained: val.marks_obtained,
      is_absent: val.is_absent,
      remarks: val.remarks,
    }));

    const res = await academicsService.submitMarks(activeExam.id, payload);
    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Exam marks recorded and graded.");
      setIsMarksModalOpen(false);
      loadData();
    }
  };

  const openScorecard = async (exam: Exam) => {
    setActiveExam(exam);
    setLoading(true);
    try {
      const res = await academicsService.getExamMarks(exam.id);
      setScorecardMarks(res.data);
      setIsScorecardOpen(true);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load scorecard.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (exam: Exam) => {
    const nextState = !exam.is_published;
    const res = await academicsService.publishResults(exam.id, nextState);
    if (res.success) {
      setSuccessNotice(
        nextState
          ? "Exam results published and visible to students."
          : "Exam results marked as draft."
      );
      loadData();
    } else {
      setErrorNotice(res.error || "Failed to update publish state.");
    }
  };

  const canManage = role === "owner" || role === "admin" || role === "teacher";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">ACADEMIC EXAMINATIONS & EVALUATIONS</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">Exams & Marks Grading</h1>
          <p className="text-sm text-slate-500">
            Create assessment tests, record student marks, compute automated grades (A+ to F), and publish student scorecards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-56">
            <Select
              options={[
                { value: "all", label: "All Batches" },
                ...batches.map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            />
          </div>

          {canManage && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Exam
            </Button>
          )}
        </div>
      </div>

      {errorNotice && (
        <AlertNotice
          type="error"
          message={errorNotice}
          onDismiss={() => setErrorNotice(null)}
        />
      )}

      {successNotice && (
        <AlertNotice
          type="success"
          message={successNotice}
          onDismiss={() => setSuccessNotice(null)}
        />
      )}

      {loading ? (
        <LoadingSpinner label="Loading exams catalog..." size="lg" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200">
              <CalendarDays size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-700">No exams created yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Schedule a unit test, midterm, or mock test to evaluate student performance.
              </p>
            </div>
          ) : (
            exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant={exam.is_published ? "green" : "neutral"} size="sm">
                      {exam.is_published ? "Published" : "Draft / Unpublished"}
                    </Badge>
                    <span className="text-xs text-slate-400 font-medium">
                      {exam.exam_date}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-lg leading-snug">{exam.title}</h3>
                  <div className="mt-1 text-xs text-[#16466f] font-semibold">{exam.subject}</div>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Batch</span>
                      <b className="text-slate-800 truncate block">{exam.batch_name || "—"}</b>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Max / Passing</span>
                      <b className="text-slate-800">
                        {exam.total_marks} / {exam.passing_marks} pts
                      </b>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Award size={14} />}
                    onClick={() => openScorecard(exam)}
                  >
                    Results
                  </Button>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openMarksEntry(exam)}
                      >
                        Enter Marks
                      </Button>

                      <Button
                        variant={exam.is_published ? "ghost" : "primary"}
                        size="sm"
                        onClick={() => handleTogglePublish(exam)}
                        title={exam.is_published ? "Unpublish Results" : "Publish to Students"}
                      >
                        {exam.is_published ? <Lock size={14} /> : <Share2 size={14} />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Exam Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Academic Examination"
        >
          <form onSubmit={handleCreateExam} className="space-y-4">
            <Select
              label="Select Batch"
              required
              options={batches.map((b) => ({ value: b.id, label: `${b.name} (${b.course_name})` }))}
              value={newExam.batch_id}
              onChange={(e) => setNewExam({ ...newExam, batch_id: e.target.value })}
            />

            <Input
              label="Exam Title"
              required
              placeholder="e.g. JEE Mock Assessment #4"
              value={newExam.title}
              onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Subject"
                required
                placeholder="Physics / Mathematics"
                value={newExam.subject}
                onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
              />

              <Input
                label="Exam Date"
                type="date"
                required
                value={newExam.exam_date}
                onChange={(e) => setNewExam({ ...newExam, exam_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Total Marks"
                type="number"
                required
                value={newExam.total_marks}
                onChange={(e) => setNewExam({ ...newExam, total_marks: Number(e.target.value) })}
              />

              <Input
                label="Passing Marks"
                type="number"
                required
                value={newExam.passing_marks}
                onChange={(e) => setNewExam({ ...newExam, passing_marks: Number(e.target.value) })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<CheckCircle2 size={16} />}
              >
                Create Exam
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Marks Entry Modal */}
      {isMarksModalOpen && activeExam && (
        <Modal
          isOpen={isMarksModalOpen}
          onClose={() => setIsMarksModalOpen(false)}
          title={`Enter Marks — ${activeExam.title} (${activeExam.subject})`}
        >
          <div className="space-y-4 max-h-[70vh] flex flex-col">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex justify-between">
              <span><b>Batch:</b> {activeExam.batch_name}</span>
              <span><b>Total Marks:</b> {activeExam.total_marks}</span>
              <span><b>Passing Marks:</b> {activeExam.passing_marks}</span>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1">
              {marksStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No students currently enrolled in this batch.
                </div>
              ) : (
                marksStudents.map((st) => {
                  const state = studentMarksState[st.id] || { marks_obtained: 0, is_absent: false };
                  const pct = (state.marks_obtained / activeExam.total_marks) * 100;
                  const autoGrade =
                    pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 50 ? "C" : pct >= 40 ? "D" : "F";

                  return (
                    <div key={st.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-[140px]">
                        <b className="text-xs text-slate-800 block truncate">{st.full_name}</b>
                        <small className="text-[11px] text-slate-400 font-mono">{st.admission_no}</small>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.is_absent}
                            onChange={(e) =>
                              setStudentMarksState({
                                ...studentMarksState,
                                [st.id]: { ...state, is_absent: e.target.checked },
                              })
                            }
                            className="rounded border-slate-300 text-rose-600"
                          />
                          <span>Absent</span>
                        </label>

                        <div className="w-24">
                          <Input
                            type="number"
                            disabled={state.is_absent}
                            value={state.marks_obtained}
                            onChange={(e) =>
                              setStudentMarksState({
                                ...studentMarksState,
                                [st.id]: {
                                  ...state,
                                  marks_obtained: Math.min(
                                    activeExam.total_marks,
                                    Math.max(0, Number(e.target.value))
                                  ),
                                },
                              })
                            }
                          />
                        </div>

                        <div className="w-12 text-center">
                          {state.is_absent ? (
                            <Badge variant="red" size="sm">ABS</Badge>
                          ) : (
                            <Badge variant={pct >= activeExam.passing_marks ? "green" : "red"} size="sm">
                              {autoGrade}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMarksModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isSubmitting}
                icon={<CheckCircle2 size={16} />}
                onClick={handleSaveMarks}
              >
                Save Marks & Compute Grades
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Scorecard Modal */}
      {isScorecardOpen && activeExam && (
        <Modal
          isOpen={isScorecardOpen}
          onClose={() => setIsScorecardOpen(false)}
          title={`Scorecard & Rankings — ${activeExam.title}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex justify-between">
              <span><b>Batch:</b> {activeExam.batch_name}</span>
              <span><b>Max Marks:</b> {activeExam.total_marks}</span>
              <span><b>Passing Marks:</b> {activeExam.passing_marks}</span>
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Admission No</th>
                    <th className="py-2.5 px-3 text-right">Marks</th>
                    <th className="py-2.5 px-3 text-right">Percentage</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scorecardMarks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No marks submitted yet for this exam.
                      </td>
                    </tr>
                  ) : (
                    scorecardMarks.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-700">
                          {m.rank ? `#${m.rank}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {m.student_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {m.admission_no}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {m.is_absent ? "ABS" : m.marks_obtained}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {m.is_absent ? "0.0%" : `${m.percentage.toFixed(1)}%`}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant={
                              m.is_absent
                                ? "red"
                                : m.grade === "A+" || m.grade === "A"
                                ? "green"
                                : m.grade === "B" || m.grade === "C"
                                ? "blue"
                                : "red"
                            }
                            size="sm"
                          >
                            {m.grade || "F"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setIsScorecardOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
