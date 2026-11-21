import React, { useState, useEffect } from "react";
import {
  FolderDown,
  FileText,
  Upload,
  Plus,
  CheckCircle2,
  File,
  Download,
  HelpCircle,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button, Input, Select, Badge, LoadingSpinner, AlertNotice, Modal } from "../components/common";
import { materialsService } from "../services/materialsService";
import { batchesService } from "../services/batchesService";
import { useAuth } from "../hooks/useAuth";
import type { Homework, StudyMaterial, StudentDoubt } from "../types/materials";
import type { Batch } from "../types";

export const HomeworkMaterials: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<"materials" | "homework" | "doubts">("materials");
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [doubts, setDoubts] = useState<StudentDoubt[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Doubt response modal
  const [activeDoubtToRespond, setActiveDoubtToRespond] = useState<StudentDoubt | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isRespondingDoubt, setIsRespondingDoubt] = useState(false);

  // Form states
  const [materialForm, setMaterialForm] = useState({
    batch_id: "",
    title: "",
    subject: "",
    description: "",
    category: "notes",
    file_url: "",
  });

  const [homeworkForm, setHomeworkForm] = useState({
    batch_id: "",
    title: "",
    subject: "Physics",
    description: "",
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
    max_marks: 20,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedBatchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const bFilter = selectedBatchId === "all" ? undefined : selectedBatchId;
      const [matRes, hwRes, batchRes, doubtsRes] = await Promise.all([
        materialsService.getStudyMaterials(bFilter),
        materialsService.getHomework(bFilter),
        batchesService.getBatches(),
        materialsService.getStudentDoubts(undefined, bFilter),
      ]);

      setMaterials(matRes.data);
      setHomeworkList(hwRes.data);
      setBatches(batchRes.data);
      setDoubts(doubtsRes.data || []);

      if (batchRes.data.length > 0 && !materialForm.batch_id) {
        setMaterialForm((prev) => ({ ...prev, batch_id: batchRes.data[0].id }));
        setHomeworkForm((prev) => ({ ...prev, batch_id: batchRes.data[0].id }));
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load materials");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.title || !materialForm.subject) {
      setErrorNotice("Title and Subject are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    const res = await materialsService.createStudyMaterial({
      batch_id: materialForm.batch_id || null,
      title: materialForm.title,
      subject: materialForm.subject,
      description: materialForm.description || null,
      category: materialForm.category,
      file_url: materialForm.file_url || "https://pradeepclasses.in/resources/sample-notes.pdf",
      file_name: `${materialForm.title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      file_size_bytes: 1048576, // 1MB mock
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Study material published successfully.");
      setIsMaterialModalOpen(false);
      loadData();
    }
  };

  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeworkForm.batch_id || !homeworkForm.title || !homeworkForm.due_date) {
      setErrorNotice("Please fill in batch, title and due date.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    const res = await materialsService.createHomework({
      batch_id: homeworkForm.batch_id,
      title: homeworkForm.title,
      subject: homeworkForm.subject || "General",
      description: homeworkForm.description || null,
      due_date: homeworkForm.due_date,
      max_marks: Number(homeworkForm.max_marks) || null,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Homework assignment published.");
      setIsHomeworkModalOpen(false);
      loadData();
    }
  };

  const handleRespondDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubtToRespond || !responseText.trim()) return;

    setIsRespondingDoubt(true);
    const res = await materialsService.respondToDoubt(activeDoubtToRespond.id, responseText.trim());
    setIsRespondingDoubt(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Response sent to student.");
      setActiveDoubtToRespond(null);
      setResponseText("");
      loadData();
    }
  };

  const canManage = role === "owner" || role === "admin" || role === "teacher";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">ACADEMIC CONTENT REPOSITORY</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">Study Materials & Homework</h1>
          <p className="text-sm text-slate-500">
            Share chapter notes, previous years questions, formulas, and daily assignments.
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
            <div className="flex gap-2">
              {activeTab === "materials" ? (
                <Button
                  variant="primary"
                  icon={<Plus size={16} />}
                  onClick={() => setIsMaterialModalOpen(true)}
                >
                  Upload Notes
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={<Plus size={16} />}
                  onClick={() => setIsHomeworkModalOpen(true)}
                >
                  Assign Homework
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("materials")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "materials"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FolderDown size={17} />
          Study Materials & Notes ({materials.length})
        </button>
        <button
          onClick={() => setActiveTab("homework")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "homework"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={17} />
          Homework & Assignments ({homeworkList.length})
        </button>
        <button
          onClick={() => setActiveTab("doubts")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "doubts"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HelpCircle size={17} />
          Student Doubts ({doubts.length})
          {doubts.filter((d) => d.status === "pending").length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {doubts.filter((d) => d.status === "pending").length} pending
            </span>
          )}
        </button>
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
        <LoadingSpinner label="Loading repository..." size="lg" />
      ) : activeTab === "materials" ? (
        /* Materials Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200">
              <FolderDown size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-700">No study materials uploaded yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload chapter PDFs, formula sheets, or PYQs for students.
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
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {m.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug">{m.title}</h3>

                  {m.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {m.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {m.batch_name || "All Batches"}
                    </span>
                    <span>{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <File size={13} /> {m.file_name || "Document.pdf"}
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
      ) : activeTab === "homework" ? (
        /* Homework Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homeworkList.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200">
              <FileText size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-700">No active homework assignments</h3>
              <p className="text-xs text-slate-500 mt-1">
                Assign practice problems or mock exercises to track student progress.
              </p>
            </div>
          ) : (
            homeworkList.map((hw) => {
              const isOverdue = new Date(hw.due_date) < new Date();
              return (
                <div
                  key={hw.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant={isOverdue ? "red" : "amber"} size="sm">
                        Due: {hw.due_date}
                      </Badge>
                      {hw.max_marks && (
                        <span className="text-xs font-bold text-slate-700">
                          Max: {hw.max_marks} pts
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-snug">{hw.title}</h3>

                    {hw.description && (
                      <p className="text-xs text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                        {hw.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {hw.batch_name || "Assigned Batch"}
                      </span>
                      <span>Assigned: {new Date(hw.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Doubts Tab */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Student Academic Doubt Desk</h3>
                <p className="text-xs text-slate-500">
                  Questions submitted by students for batch lectures and subject topics.
                </p>
              </div>
              <Badge variant="blue" size="sm">
                {doubts.length} Queries
              </Badge>
            </div>

            {doubts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-xs">
                No student doubts logged for this batch filter.
              </div>
            ) : (
              <div className="space-y-3">
                {doubts.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="blue" size="sm">{d.subject}</Badge>
                        <span className="font-bold text-slate-800">{d.student_name}</span>
                        {d.batch_name && (
                          <span className="text-slate-400 font-mono text-[11px]">• {d.batch_name}</span>
                        )}
                        {d.topic && <span className="text-slate-600 font-semibold">• {d.topic}</span>}
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

                    <p className="text-xs text-slate-900 font-medium leading-relaxed">{d.question}</p>

                    {d.response ? (
                      <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                        <span className="font-bold block text-[10px] uppercase text-emerald-700">
                          Faculty Resolution:
                        </span>
                        <p className="mt-0.5">{d.response}</p>
                      </div>
                    ) : (
                      canManage && (
                        <div className="pt-2 flex justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<MessageSquare size={13} />}
                            onClick={() => {
                              setActiveDoubtToRespond(d);
                              setResponseText("");
                            }}
                          >
                            Answer Query
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Answer Doubt Modal */}
      {activeDoubtToRespond && (
        <Modal
          isOpen={!!activeDoubtToRespond}
          onClose={() => setActiveDoubtToRespond(null)}
          title={`Answer Student Query: ${activeDoubtToRespond.subject}`}
          subtitle={`Student: ${activeDoubtToRespond.student_name} • ${activeDoubtToRespond.topic || "General"}`}
        >
          <form onSubmit={handleRespondDoubt} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-1">Student's Question:</span>
              <p className="text-slate-800 italic">{activeDoubtToRespond.question}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Faculty Resolution / Explanation *
              </label>
              <textarea
                required
                rows={5}
                placeholder="Write clear explanation, formula references, or solved steps..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#16466f]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveDoubtToRespond(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isRespondingDoubt}
                icon={<Send size={13} />}
              >
                Send Resolution
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload Material Modal */}
      {isMaterialModalOpen && (
        <Modal
          isOpen={isMaterialModalOpen}
          onClose={() => setIsMaterialModalOpen(false)}
          title="Upload Study Material / Notes"
        >
          <form onSubmit={handleCreateMaterial} className="space-y-4">
            <Input
              label="Document Title"
              required
              placeholder="e.g. Chapter 4 - Thermodynamics Formula Sheet"
              value={materialForm.title}
              onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Subject"
                required
                placeholder="Physics / Chemistry / Maths"
                value={materialForm.subject}
                onChange={(e) => setMaterialForm({ ...materialForm, subject: e.target.value })}
              />

              <Select
                label="Category"
                options={[
                  { value: "notes", label: "Chapter Notes" },
                  { value: "formula_sheet", label: "Formula Sheet" },
                  { value: "pyq", label: "Previous Years Questions (PYQs)" },
                  { value: "assignment", label: "Practice Paper" },
                  { value: "other", label: "General Reference" },
                ]}
                value={materialForm.category}
                onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
              />
            </div>

            <Select
              label="Target Batch"
              options={[
                { value: "", label: "Open to All Batches" },
                ...batches.map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={materialForm.batch_id}
              onChange={(e) => setMaterialForm({ ...materialForm, batch_id: e.target.value })}
            />

            <Input
              label="Resource Document URL (or storage link)"
              placeholder="https://example.com/drive/physics-notes.pdf"
              value={materialForm.file_url}
              onChange={(e) => setMaterialForm({ ...materialForm, file_url: e.target.value })}
            />

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description / Topic Notes</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16466f]"
                rows={3}
                placeholder="Include brief summary or instructions for students..."
                value={materialForm.description}
                onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMaterialModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<Upload size={16} />}
              >
                Publish Material
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Homework Modal */}
      {isHomeworkModalOpen && (
        <Modal
          isOpen={isHomeworkModalOpen}
          onClose={() => setIsHomeworkModalOpen(false)}
          title="Create Homework Assignment"
        >
          <form onSubmit={handleCreateHomework} className="space-y-4">
            <Select
              label="Assign to Batch"
              required
              options={batches.map((b) => ({ value: b.id, label: b.name }))}
              value={homeworkForm.batch_id}
              onChange={(e) => setHomeworkForm({ ...homeworkForm, batch_id: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Assignment Title"
                required
                placeholder="e.g. Exercise 7.2"
                value={homeworkForm.title}
                onChange={(e) => setHomeworkForm({ ...homeworkForm, title: e.target.value })}
              />

              <Input
                label="Subject"
                required
                placeholder="e.g. Physics"
                value={homeworkForm.subject}
                onChange={(e) => setHomeworkForm({ ...homeworkForm, subject: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Submission Due Date"
                type="date"
                required
                value={homeworkForm.due_date}
                onChange={(e) => setHomeworkForm({ ...homeworkForm, due_date: e.target.value })}
              />

              <Input
                label="Maximum Score / Marks"
                type="number"
                value={homeworkForm.max_marks}
                onChange={(e) => setHomeworkForm({ ...homeworkForm, max_marks: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Assignment Details</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16466f]"
                rows={4}
                placeholder="Mention page numbers, questions to solve, or submission instructions..."
                value={homeworkForm.description}
                onChange={(e) => setHomeworkForm({ ...homeworkForm, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsHomeworkModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<CheckCircle2 size={16} />}
              >
                Publish Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
