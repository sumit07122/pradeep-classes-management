import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  MapPin,
  User,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button, Input, Select, Badge, LoadingSpinner, AlertNotice, Modal } from "../components/common";
import { timetableService } from "../services/timetableService";
import { batchesService } from "../services/batchesService";
import { teachersService } from "../services/teachersService";
import { useAuth } from "../hooks/useAuth";
import type { TimetableEntry, DayOfWeek } from "../types/timetable";
import type { Batch, Teacher } from "../types";

const DAYS_OF_WEEK: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const Timetable: React.FC = () => {
  const { role } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // New entry form state
  const [formData, setFormData] = useState<{
    batch_id: string;
    subject: string;
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    teacher_id: string;
    room_number: string;
  }>({
    batch_id: "",
    subject: "",
    day_of_week: "Monday",
    start_time: "09:00",
    end_time: "10:30",
    teacher_id: "",
    room_number: "Room 101",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedBatchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, bRes, teachRes] = await Promise.all([
        timetableService.getTimetable(selectedBatchId === "all" ? undefined : selectedBatchId),
        batchesService.getBatches(),
        teachersService.getTeachers(),
      ]);

      setEntries(tRes.data);
      setBatches(bRes.data);
      setTeachers(teachRes.data);

      if (bRes.data.length > 0 && !formData.batch_id) {
        setFormData((prev) => ({
          ...prev,
          batch_id: bRes.data[0].id,
          teacher_id: teachRes.data[0]?.id || "",
        }));
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load timetable data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_id || !formData.subject || !formData.start_time || !formData.end_time) {
      setErrorNotice("Please fill in all required fields.");
      return;
    }

    if (formData.start_time >= formData.end_time) {
      setErrorNotice("End time must be after start time. (Please use 24-hour format, e.g. 13:30 for 1:30 PM).");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const result = await timetableService.createEntry({
      batch_id: formData.batch_id,
      subject: formData.subject,
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      teacher_id: formData.teacher_id || null,
      room_number: formData.room_number || null,
      is_active: true,
    });

    setIsSubmitting(false);

    if (result.error) {
      setErrorNotice(result.error);
    } else {
      setSuccessNotice("Timetable slot added successfully.");
      setIsModalOpen(false);
      loadData();
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this timetable entry?")) return;
    const res = await timetableService.deleteEntry(id);
    if (res.success) {
      setSuccessNotice("Entry removed.");
      loadData();
    } else {
      setErrorNotice(res.error || "Failed to delete entry.");
    }
  };

  const canEdit = role === "super_admin" || role === "owner" || role === "admin";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">ACADEMIC SCHEDULE</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">Institute Timetable</h1>
          <p className="text-sm text-slate-500">
            Weekly class schedules with automated teacher & room conflict detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Batch Selector Filter */}
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

          {canEdit && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsModalOpen(true)}
            >
              Add Class Slot
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
        <LoadingSpinner label="Loading weekly schedules..." size="lg" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayEntries = entries
              .filter((e) => e.day_of_week.toLowerCase() === day.toLowerCase())
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <div
                key={day}
                className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[380px]"
              >
                <div className="p-3 bg-slate-50 border-b border-slate-200 rounded-t-xl flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    {day}
                  </span>
                  <Badge variant={dayEntries.length > 0 ? "blue" : "neutral"} size="sm">
                    {dayEntries.length} {dayEntries.length === 1 ? "Class" : "Classes"}
                  </Badge>
                </div>

                <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto max-h-[600px]">
                  {dayEntries.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-slate-400 italic">
                      No classes scheduled
                    </div>
                  ) : (
                    dayEntries.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-200/90 bg-white hover:border-[#16466f]/40 transition shadow-sm hover:shadow"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-[#16466f] flex items-center gap-1">
                            <Clock size={12} />
                            {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteEntry(item.id)}
                              className="text-slate-300 hover:text-rose-500 transition"
                              title="Delete Slot"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          {item.subject}
                        </h4>

                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5 truncate">
                            <BookOpen size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate font-medium text-slate-700">
                              {item.batch_name || "Assigned Batch"}
                            </span>
                          </div>

                          {item.teacher_name && (
                            <div className="flex items-center gap-1.5 truncate">
                              <User size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{item.teacher_name}</span>
                            </div>
                          )}

                          {item.room_number && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span>{item.room_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Slot Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Schedule Class Slot"
        >
          <form onSubmit={handleCreateEntry} className="space-y-4">
            <Select
              label="Select Batch"
              required
              options={batches.map((b) => ({ value: b.id, label: `${b.name} (${b.course_name})` }))}
              value={formData.batch_id}
              onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
            />

            <Input
              label="Subject / Topic"
              required
              placeholder="e.g. Physics - Mechanics"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Day of Week"
                required
                options={DAYS_OF_WEEK.map((d) => ({ value: d, label: d }))}
                value={formData.day_of_week}
                onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value as DayOfWeek })}
              />

              <Input
                label="Room Number"
                placeholder="e.g. Room 102"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Time (24h)"
                  type="time"
                  required
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />

                <Input
                  label="End Time (24h)"
                  type="time"
                  required
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Format: 24-hour clock (e.g. 09:00 for 9 AM, 13:30 for 1:30 PM, 17:00 for 5 PM).
              </p>
            </div>

            <Select
              label="Assigned Faculty (Optional)"
              options={[
                { value: "", label: "No faculty assigned" },
                ...teachers.map((t) => ({ value: t.id, label: `${t.full_name} (${t.subject})` })),
              ]}
              value={formData.teacher_id}
              onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
            />

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                Automatic conflict detection will ensure the teacher and classroom are not booked for another batch at the same time.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<CheckCircle2 size={16} />}
              >
                Save Schedule Slot
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
