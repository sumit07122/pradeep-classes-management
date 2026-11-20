import React, { useState, useEffect } from "react";
import { Plus, Phone } from "lucide-react";
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
import type { Teacher } from "../types";

export const Teachers: React.FC = () => {
  const { isDemoMode } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await teachersService.getTeachers();
      setTeachers(res.data);
      setLoading(false);
    }
    load();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setIsSubmitting(true);
    const res = await teachersService.createTeacher({
      full_name: fullName.trim(),
      subject,
      phone: phone.trim(),
      assigned_batches: ["JEE Morning"],
      is_active: true,
    });
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setNotice("Failed to save teacher record.");
      return;
    }

    setTeachers((prev) => [res.data!, ...prev]);
    setShowModal(false);
    setFullName("");
    setPhone("");
    setNotice(
      isDemoMode
        ? "Faculty added in DEMO mode. Connect Supabase to persist records."
        : `Teacher ${res.data.full_name} registered successfully.`
    );
    window.setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice type="success" message={notice} onDismiss={() => setNotice(null)} />
      )}

      <div className="welcome-row">
        <div>
          <div className="eyebrow">FACULTY DIRECTORY</div>
          <h1>Teaching Team</h1>
          <p>Manage institute faculty members, subjects, and batch assignments.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
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
              <div className="teacher-card" key={t.id}>
                <div className="flex items-start justify-between">
                  <div className="teacher-avatar">
                    {t.full_name
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  {isDemoMode && (
                    <Badge variant="demo" size="sm">
                      DEMO
                    </Badge>
                  )}
                </div>
                <h3>{t.full_name}</h3>
                <p className="font-semibold text-slate-600">{t.subject}</p>

                <div className="teacher-batches">
                  <span>ASSIGNED BATCHES</span>
                  {t.assigned_batches.map((b) => (
                    <i key={b}>{b}</i>
                  ))}
                </div>

                <div className="teacher-phone flex items-center gap-1.5 text-slate-500">
                  <Phone size={13} />
                  <span>{t.phone || "No phone provided"}</span>
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
        subtitle="FACULTY MANAGEMENT"
      >
        <form onSubmit={handleAddTeacher} className="space-y-4">
          <Input
            label="Teacher Full Name"
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Dr. Ramesh Gupta"
          />

          <Select
            label="Subject Specialization"
            options={["Physics", "Chemistry", "Mathematics", "Biology", "English"]}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <Input
            label="Mobile Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            maxLength={10}
          />

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save faculty profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
