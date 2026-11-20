import React, { useState, useEffect } from "react";
import { Plus, Phone, Edit2, CheckCircle2 } from "lucide-react";
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
import type { Teacher } from "../types";

export const Teachers: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [phone, setPhone] = useState("");
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

    const res = await teachersService.createTeacher({
      full_name: fullName.trim(),
      subject,
      phone: phone.trim(),
      assigned_batches: ["General Subject Batch"],
      is_active: true,
    });
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setErrorNotice(res.error || "Failed to save teacher record.");
      return;
    }

    setShowModal(false);
    setFullName("");
    setPhone("");
    setNotice(`Faculty ${res.data.full_name} registered successfully.`);
    loadData();
  };

  const openEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setFullName(t.full_name);
    setSubject(t.subject);
    setPhone(t.phone || "");
    setShowEditModal(true);
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    setIsSubmitting(true);
    setErrorNotice(null);

    const res = await teachersService.updateTeacher(editingTeacher.id, {
      full_name: fullName.trim(),
      subject,
      phone: phone.trim(),
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setNotice(`Updated faculty record for ${fullName}.`);
      setShowEditModal(false);
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
          <div className="eyebrow">FACULTY DIRECTORY</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">Teaching Team</h1>
          <p className="text-sm text-slate-500">Manage institute faculty members, subjects, and batch assignments.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setFullName("");
            setPhone("");
            setSubject("Physics");
            setShowModal(true);
          }}
          icon={<Plus size={16} />}
        >
          Add teacher
        </Button>
      </div>

      <section className="panel directory-panel">
        <div className="panel-heading">
          <div>
            <h3>Active Faculty ({teachers.length})</h3>
            <p>Teaching staff currently active at Pradeep Classes</p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading faculty directory..." />
        ) : teachers.length === 0 ? (
          <EmptyState
            title="No faculty members recorded"
            description="Add your first teacher to assign subjects and batches for attendance tracking."
            actionLabel="Add teacher"
            onAction={() => setShowModal(true)}
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
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1 text-slate-400 hover:text-[#16466f] transition"
                      title="Edit Faculty"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>

                <h3>{t.full_name}</h3>
                <p className="font-semibold text-slate-600">{t.subject}</p>

                <div className="teacher-batches">
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

                  <button
                    onClick={() => handleToggleStatus(t)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-800 transition"
                  >
                    {t.is_active ? "Deactivate" : "Activate"}
                  </button>
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
        title="Register Faculty Member"
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
    </div>
  );
};
