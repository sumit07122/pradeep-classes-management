import React, { useState, useEffect } from "react";
import { Plus, Phone, Edit2, Trash2, CheckCircle2, Banknote, AlertTriangle } from "lucide-react";
import { teachersService } from "../services/teachersService";
import {
  Button,
  Modal,
  Input,
  Select,
  Badge,
  EmptyState,
  LoadingSpinner,
  AlertNotice,
} from "../components/common";
import { useAuth } from "../hooks/useAuth";
import type { Teacher, TeacherSalaryConfigData } from "../types";

export const Teachers: React.FC = () => {
  const { role } = useAuth();
  const canManage = role === "owner" || role === "admin" || role === "super_admin";

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [phone, setPhone] = useState("");
  const [calcType, setCalcType] = useState<"monthly_fixed" | "per_lecture" | "hourly">("monthly_fixed");
  const [baseAmount, setBaseAmount] = useState<number | string>(45000);
  const [perLectureRate, setPerLectureRate] = useState<number | string>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const tRes = await teachersService.getTeachers();
      setTeachers(tRes.data);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load faculty.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setIsSubmitting(true);
    setErrorNotice(null);

    const salary_config: TeacherSalaryConfigData = {
      calculation_type: calcType,
      base_amount: calcType === "monthly_fixed" ? (Number(baseAmount) || 0) : 0,
      per_lecture_rate: calcType !== "monthly_fixed" ? (Number(perLectureRate) || 0) : 0,
    };

    const res = await teachersService.createTeacher({
      full_name: fullName.trim(),
      subject,
      phone: phone.trim(),
      assigned_batches: ["General Subject Batch"],
      is_active: true,
      salary_config,
    });
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setErrorNotice(res.error || "Failed to save teacher record.");
      return;
    }

    setShowModal(false);
    setFullName("");
    setPhone("");
    setBaseAmount(45000);
    setPerLectureRate(0);
    setNotice(`Faculty ${res.data.full_name} registered successfully with salary structure.`);
    loadData();
  };

  const openEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setFullName(t.full_name);
    setSubject(t.subject);
    setPhone(t.phone || "");
    if (t.salary_config) {
      setCalcType(t.salary_config.calculation_type);
      setBaseAmount(t.salary_config.base_amount);
      setPerLectureRate(t.salary_config.per_lecture_rate);
    } else {
      setCalcType("monthly_fixed");
      setBaseAmount(0);
      setPerLectureRate(0);
    }
    setShowEditModal(true);
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    setIsSubmitting(true);
    setErrorNotice(null);

    const salary_config: TeacherSalaryConfigData = {
      calculation_type: calcType,
      base_amount: calcType === "monthly_fixed" ? (Number(baseAmount) || 0) : 0,
      per_lecture_rate: calcType !== "monthly_fixed" ? (Number(perLectureRate) || 0) : 0,
    };

    const res = await teachersService.updateTeacher(editingTeacher.id, {
      full_name: fullName.trim(),
      subject,
      phone: phone.trim(),
      salary_config,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setNotice(`Updated faculty & remuneration details for ${fullName}.`);
      setShowEditModal(false);
      loadData();
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher) return;
    setIsSubmitting(true);
    setErrorNotice(null);

    const res = await teachersService.deleteTeacher(deletingTeacher.id);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorNotice(res.error || "Failed to delete teacher.");
    } else {
      setNotice(`Faculty ${deletingTeacher.full_name} deleted successfully.`);
      setDeletingTeacher(null);
      loadData();
    }
  };

  const handleToggleStatus = async (t: Teacher) => {
    const nextStatus = !t.is_active;
    const res = await teachersService.toggleTeacherStatus(t.id, nextStatus);
    if (res.success) {
      setNotice(`Status for ${t.full_name} set to ${nextStatus ? "Active" : "Inactive"}.`);
      loadData();
    } else {
      setErrorNotice(res.error || "Failed to update status.");
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice type="success" message={notice} onDismiss={() => setNotice(null)} />
      )}
      {errorNotice && (
        <AlertNotice type="error" message={errorNotice} onDismiss={() => setErrorNotice(null)} />
      )}

      <div className="welcome-row">
        <div>
          <div className="eyebrow">FACULTY DIRECTORY & REMUNERATION</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">Teaching Team</h1>
          <p className="text-sm text-slate-500">
            Manage institute faculty members, subjects, salary structures, and assignments.
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={() => {
              setFullName("");
              setPhone("");
              setSubject("Physics");
              setCalcType("monthly_fixed");
              setBaseAmount(45000);
              setPerLectureRate(0);
              setShowModal(true);
            }}
            icon={<Plus size={16} />}
          >
            Add teacher
          </Button>
        )}
      </div>

      <section className="panel directory-panel">
        <div className="panel-heading">
          <div>
            <h3>Active Faculty ({teachers.length})</h3>
            <p>Teaching staff and remuneration configurations at Pradeep Classes</p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading faculty directory..." />
        ) : teachers.length === 0 ? (
          <EmptyState
            title="No faculty members recorded"
            description="Add your first teacher to assign subjects and batches for attendance tracking."
            actionLabel={canManage ? "Add teacher" : undefined}
            onAction={canManage ? () => setShowModal(true) : undefined}
          />
        ) : (
          <div className="teacher-grid">
            {teachers.map((t) => (
              <div className="teacher-card relative" key={t.id}>
                <div className="flex items-start justify-between">
                  <div className="teacher-avatar">
                    {t.full_name
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={t.is_active ? "green" : "red"} size="sm">
                      {t.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1 text-slate-400 hover:text-[#16466f] transition"
                          title="Edit Faculty & Salary"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingTeacher(t)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Delete Faculty Member"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <h3>{t.full_name}</h3>
                <p className="font-semibold text-slate-600">{t.subject}</p>

                {/* Remuneration Badge */}
                <div className="mt-2.5 p-2 rounded-lg bg-emerald-50/80 border border-emerald-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Banknote size={14} className="text-emerald-600" />
                    <span>Remuneration</span>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-900">
                    {t.salary_config?.calculation_type === "monthly_fixed" && (
                      <>₹{t.salary_config.base_amount.toLocaleString("en-IN")}/mo</>
                    )}
                    {t.salary_config?.calculation_type === "per_lecture" && (
                      <>₹{t.salary_config.per_lecture_rate.toLocaleString("en-IN")}/lec</>
                    )}
                    {t.salary_config?.calculation_type === "hourly" && (
                      <>₹{t.salary_config.per_lecture_rate.toLocaleString("en-IN")}/hr</>
                    )}
                    {!t.salary_config && <span className="text-slate-400 font-normal">Not configured</span>}
                  </span>
                </div>

                <div className="teacher-batches mt-2">
                  <span>ASSIGNED BATCHES</span>
                  {t.assigned_batches.map((b) => (
                    <i key={b}>{b}</i>
                  ))}
                </div>

                <div className="teacher-phone flex items-center justify-between text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Phone size={13} />
                    <span>{t.phone || "No phone provided"}</span>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-800 transition"
                    >
                      {t.is_active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Teacher Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Register Faculty & Remuneration"
      >
        <form onSubmit={handleAddTeacher} className="space-y-4">
          <Input
            label="Full name"
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Dr. Rajesh Sharma"
          />

          <Select
            label="Primary subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            options={[
              { value: "Physics", label: "Physics" },
              { value: "Chemistry", label: "Chemistry" },
              { value: "Mathematics", label: "Mathematics" },
              { value: "Biology", label: "Biology" },
              { value: "Foundation Science", label: "Foundation Science" },
            ]}
          />

          <Input
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Banknote size={14} className="text-emerald-600" />
              Salary & Remuneration Structure
            </h4>

            <Select
              label="Salary Type"
              value={calcType}
              onChange={(e) => setCalcType(e.target.value as any)}
              options={[
                { value: "monthly_fixed", label: "Monthly Fixed Retainer" },
                { value: "per_lecture", label: "Per Lecture Basis" },
                { value: "hourly", label: "Hourly Rate" },
              ]}
            />

            {calcType === "monthly_fixed" ? (
              <Input
                label="Monthly Fixed Base (₹)"
                type="number"
                min="0"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder="e.g. 50000"
              />
            ) : (
              <Input
                label={calcType === "per_lecture" ? "Per Lecture Rate (₹)" : "Hourly Rate (₹)"}
                type="number"
                min="0"
                value={perLectureRate}
                onChange={(e) => setPerLectureRate(e.target.value)}
                placeholder="e.g. 1500"
              />
            )}
          </div>

          <div className="modal-actions pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              Register Teacher
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      {showEditModal && editingTeacher && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={`Edit Faculty — ${editingTeacher.full_name}`}
        >
          <form onSubmit={handleUpdateTeacher} className="space-y-4">
            <Input
              label="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Select
              label="Primary subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              options={[
                { value: "Physics", label: "Physics" },
                { value: "Chemistry", label: "Chemistry" },
                { value: "Mathematics", label: "Mathematics" },
                { value: "Biology", label: "Biology" },
                { value: "Foundation Science", label: "Foundation Science" },
              ]}
            />

            <Input
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Banknote size={14} className="text-emerald-600" />
                Remuneration Structure
              </h4>

              <Select
                label="Salary Type"
                value={calcType}
                onChange={(e) => setCalcType(e.target.value as any)}
                options={[
                  { value: "monthly_fixed", label: "Monthly Fixed Retainer" },
                  { value: "per_lecture", label: "Per Lecture Basis" },
                  { value: "hourly", label: "Hourly Rate" },
                ]}
              />

              {calcType === "monthly_fixed" ? (
                <Input
                  label="Monthly Fixed Base (₹)"
                  type="number"
                  min="0"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                />
              ) : (
                <Input
                  label={calcType === "per_lecture" ? "Per Lecture Rate (₹)" : "Hourly Rate (₹)"}
                  type="number"
                  min="0"
                  value={perLectureRate}
                  onChange={(e) => setPerLectureRate(e.target.value)}
                />
              )}
            </div>

            <div className="modal-actions pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<CheckCircle2 size={16} />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Teacher Confirmation Modal */}
      {deletingTeacher && (
        <Modal
          isOpen={!!deletingTeacher}
          onClose={() => setDeletingTeacher(null)}
          title="Delete Faculty Member"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm text-rose-900">
                  Delete {deletingTeacher.full_name}?
                </h4>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  This action will permanently delete the teacher record, their salary configuration, and batch assignments.
                  If the faculty has recorded class sessions or payroll history, the system will prevent deletion to preserve academic integrity.
                </p>
              </div>
            </div>

            <div className="modal-actions pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingTeacher(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isSubmitting}
                onClick={handleDeleteTeacher}
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
