import React, { useState, useEffect } from "react";
import {
  Plus,
  Phone,
  Edit2,
  Trash2,
  CheckCircle2,
  Banknote,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { teachersService } from "../services/teachersService";
import { userService } from "../services/userService";
import { generateSecurePassword } from "../components/users/UserManagementTab";
import { CredentialsModal, type CredentialsInfo } from "../components/users/CredentialsModal";
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

export interface TeachersProps {
  initialShowModal?: boolean;
}

export const Teachers: React.FC<TeachersProps> = ({ initialShowModal = false }) => {
  const { role } = useAuth();
  const canManage = role === "owner" || role === "admin" || role === "super_admin";

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(initialShowModal);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [calcType, setCalcType] = useState<"monthly_fixed" | "per_lecture" | "hourly">("monthly_fixed");
  const [baseAmount, setBaseAmount] = useState<number | string>(45000);
  const [perLectureRate, setPerLectureRate] = useState<number | string>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Portal Account Provisioning states
  const [generateLogin, setGenerateLogin] = useState(true);
  const [tempPassword, setTempPassword] = useState(() => generateSecurePassword(10));
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CredentialsInfo | null>(null);

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

  const handleCopyPassword = async () => {
    if (!tempPassword) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tempPassword);
      }
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      // Fallback
    }
  };

  const resetAddForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setSubject("Physics");
    setCalcType("monthly_fixed");
    setBaseAmount(45000);
    setPerLectureRate(0);
    setGenerateLogin(true);
    setTempPassword(generateSecurePassword(10));
    setShowPasswordText(false);
    setCopiedPassword(false);
  };

  const openAddModal = () => {
    resetAddForm();
    setShowModal(true);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    if (generateLogin) {
      if (!email.trim()) {
        setErrorNotice("Email address is required to generate a faculty portal login account.");
        return;
      }
      if (!tempPassword || tempPassword.length < 6) {
        setErrorNotice("Temporary password must be at least 6 characters long.");
        return;
      }
    }

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

    if (res.error || !res.data) {
      setIsSubmitting(false);
      setErrorNotice(res.error || "Failed to save teacher record.");
      return;
    }

    const createdTeacher = res.data;

    if (generateLogin) {
      const userRes = await userService.createInstituteUser({
        full_name: createdTeacher.full_name,
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: tempPassword,
        role: "teacher",
        teacher_id: createdTeacher.id,
      });

      setIsSubmitting(false);

      if (userRes.error || !userRes.data) {
        setErrorNotice(
          `Faculty ${createdTeacher.full_name} registered, but creating portal login failed: ${userRes.error || "Unknown error"}. You can provision credentials manually from Settings > User Accounts.`
        );
        setShowModal(false);
        resetAddForm();
        loadData();
        return;
      }

      setShowModal(false);
      setCreatedCredentials({
        name: createdTeacher.full_name,
        username: userRes.data.email || email.trim(),
        password: tempPassword,
        phone: phone.trim() || undefined,
        role: "teacher",
        isReset: false,
      });
      resetAddForm();
      setNotice(`Faculty ${createdTeacher.full_name} registered successfully with portal access.`);
      loadData();
    } else {
      setIsSubmitting(false);
      setShowModal(false);
      resetAddForm();
      setNotice(`Faculty ${createdTeacher.full_name} registered successfully with salary structure.`);
      loadData();
    }
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
            onClick={openAddModal}
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
            onAction={canManage ? openAddModal : undefined}
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

          <Input
            label={`Email Address ${generateLogin ? "*" : "(Optional)"}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. rajesh.sharma@pradeepclasses.in"
            required={generateLogin}
          />

          {/* Portal Access & Login Account */}
          <div className="pt-2 border-t border-slate-100">
            <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-100 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={generateLogin}
                  onChange={(e) => setGenerateLogin(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#16466f] focus:ring-[#16466f]"
                />
                <div>
                  <span className="text-xs font-bold text-[#1c3045] flex items-center gap-1.5">
                    <KeyRound size={14} className="text-[#16466f]" />
                    Generate Faculty Portal Login Account
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Creates active portal credentials so the faculty member can manage batches, assignments, and attendance.
                  </span>
                </div>
              </label>

              {generateLogin && (
                <div className="space-y-2 pt-2 border-t border-sky-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Temporary Password *
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Min 6 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPasswordText ? "text" : "password"}
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        placeholder="Temporary password"
                        className="font-mono text-xs pr-10"
                        required={generateLogin}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPasswordText ? "Hide password" : "Show password"}
                      >
                        {showPasswordText ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setTempPassword(generateSecurePassword(10))}
                      icon={<RefreshCw size={13} />}
                      title="Generate new password"
                    >
                      Generate
                    </Button>

                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                      title="Copy temporary password"
                    >
                      {copiedPassword ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} className="text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-amber-700 flex items-center gap-1.5 pt-1">
                    <Sparkles size={13} className="text-amber-500 shrink-0" />
                    <span>
                      Email is required for faculty portal access. The faculty member will log in with their email address.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

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

      {/* Credentials Summary & WhatsApp Dispatch */}
      <CredentialsModal
        isOpen={Boolean(createdCredentials)}
        onClose={() => {
          setCreatedCredentials(null);
          resetAddForm();
        }}
        credentials={createdCredentials}
        whatsAppButtonLabel="Send Faculty Portal Access via WhatsApp"
        title="Faculty Portal Account Provisioned"
        subtitle="FACULTY CREDENTIAL DISPATCH"
      />
    </div>
  );
};
