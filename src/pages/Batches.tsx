import React, { useState, useEffect } from "react";
import { Plus, BookOpen, MoreHorizontal } from "lucide-react";
import { batchesService } from "../services/batchesService";
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
import type { Batch } from "../types";

export const Batches: React.FC = () => {
  const { isDemoMode } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState("JEE Advanced");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await batchesService.getBatches();
      setBatches(res.data);
      setLoading(false);
    }
    load();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const res = await batchesService.createBatch({
      name: name.trim(),
      course_name: courseName,
      academic_year: academicYear,
      is_active: true,
    });
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setNotice("Could not create batch.");
      return;
    }

    setBatches((prev) => [res.data!, ...prev]);
    setShowModal(false);
    setName("");
    setNotice(
      isDemoMode
        ? "Batch created in DEMO mode. Connect Supabase to save permanently."
        : `Batch ${res.data.name} created successfully.`
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
          <div className="eyebrow">ACADEMIC GROUPS</div>
          <h1>Courses & Batches</h1>
          <p>Organize students and faculty into structured learning groups.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          icon={<Plus size={16} />}
        >
          Create batch
        </Button>
      </div>

      <section className="panel directory-panel">
        <div className="panel-heading">
          <div>
            <h3>Active Batches ({batches.length})</h3>
            <p>Classroom learning batches for academic year 2026-2027</p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading course batches..." />
        ) : batches.length === 0 ? (
          <EmptyState
            title="No batches configured"
            description="Create your first batch to start enrolling students and allocating timetables."
            actionLabel="Create batch"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="batch-grid">
            {batches.map((b, i) => (
              <div className="batch-card" key={b.id}>
                <div className={`batch-icon tone-${i % 4}`}>
                  <BookOpen size={19} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3>{b.name}</h3>
                    {isDemoMode && (
                      <Badge variant="demo" size="sm">
                        DEMO
                      </Badge>
                    )}
                  </div>
                  <p>
                    {b.student_count || 0} students enrolled • {b.course_name}
                  </p>
                  {b.assigned_teachers && b.assigned_teachers.length > 0 && (
                    <small className="block text-[10px] text-slate-400 mt-1">
                      Faculty: {b.assigned_teachers.join(", ")}
                    </small>
                  )}
                </div>
                <button className="more-button" aria-label="Batch actions">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Batch Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create New Learning Batch"
        subtitle="BATCH CONFIGURATION"
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <Input
            label="Batch Name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. JEE Morning Advanced 2027"
          />

          <Select
            label="Target Course"
            options={["JEE Advanced", "NEET Medical", "Foundation 10th", "Board Prep 12th"]}
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
          />

          <Input
            label="Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026-2027"
          />

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Create batch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
