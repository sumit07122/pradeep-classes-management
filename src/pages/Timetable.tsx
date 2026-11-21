import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Plus,
  MapPin,
  User,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
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

  const [editingId, setEditingId] = useState<string | null>(null);

  // Preset common coaching time slots
  const PRESET_SLOTS = [
    { label: "09:00 - 10:30 AM", start: "09:00", end: "10:30" },
    { label: "11:00 - 12:30 PM", start: "11:00", end: "12:30" },
    { label: "02:00 - 03:30 PM", start: "14:00", end: "15:30" },
    { label: "04:00 - 05:30 PM", start: "16:00", end: "17:30" },
    { label: "06:00 - 07:30 PM", start: "18:00", end: "19:30" },
  ];

  // New / edit entry form state
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

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      batch_id: batches[0]?.id || "",
      subject: "",
      day_of_week: "Monday",
      start_time: "09:00",
      end_time: "10:30",
      teacher_id: teachers[0]?.id || "",
      room_number: "Room 101",
    });
    setErrorNotice(null);
    setIsModalOpen(true);
  };

  const handleStartEdit = (item: TimetableEntry) => {
    setEditingId(item.id);
    setFormData({
      batch_id: item.batch_id,
      subject: item.subject,
      day_of_week: item.day_of_week as DayOfWeek,
      start_time: item.start_time.slice(0, 5),
      end_time: item.end_time.slice(0, 5),
      teacher_id: item.teacher_id || "",
      room_number: item.room_number || "Room 101",
    });
    setErrorNotice(null);
    setIsModalOpen(true);
  };

  // Real-time conflict preview
  const liveConflict = useMemo(() => {
    if (!formData.day_of_week || !formData.start_time || !formData.end_time) return null;
    const curStart = formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time;
    const curEnd = formData.end_time.length === 5 ? `${formData.end_time}:00` : formData.end_time;

    for (const item of entries) {
      if (editingId && item.id === editingId) continue;
      if (item.day_of_week !== formData.day_of_week) continue;

      const isOverlap = curStart < item.end_time && curEnd > item.start_time;
      if (isOverlap) {
        if (formData.teacher_id && item.teacher_id === formData.teacher_id) {
          return {
            type: "faculty",
            message: `Faculty Conflict: ${item.teacher_name} is already scheduled on ${item.day_of_week} for "${item.batch_name}" between ${item.start_time.slice(0, 5)} and ${item.end_time.slice(0, 5)}.`,
          };
        }
        if (
          formData.room_number &&
          item.room_number &&
          formData.room_number.toLowerCase().trim() === item.room_number.toLowerCase().trim()
        ) {
          return {
            type: "room",
            message: `Room Conflict: ${item.room_number} is already occupied on ${item.day_of_week} for "${item.batch_name}" between ${item.start_time.slice(0, 5)} and ${item.end_time.slice(0, 5)}.`,
          };
        }
      }
    }
    return null;
  }, [formData, entries, editingId]);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_id || !formData.subject || !formData.start_time || !formData.end_time) {
      setErrorNotice("Please fill in all required fields.");
      return;
    }

    if (formData.start_time >= formData.end_time) {
      setErrorNotice("End time must be after start time. (Please use 24-hour format, e.g. 13:30 for 1:30 PM).");
      return;
    }

    if (liveConflict) {
      setErrorNotice(liveConflict.message);
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    let result;
    if (editingId) {
      result = await timetableService.updateEntry(editingId, {
        batch_id: formData.batch_id,
        subject: formData.subject,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        teacher_id: formData.teacher_id || null,
        room_number: formData.room_number || null,
      });
    } else {
      result = await timetableService.createEntry({
        batch_id: formData.batch_id,
        subject: formData.subject,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        teacher_id: formData.teacher_id || null,
        room_number: formData.room_number || null,
        is_active: true,
      });
    }

    setIsSubmitting(false);

    if (result.error) {
      setErrorNotice(result.error);
    } else {
      setSuccessNotice(editingId ? "Timetable slot updated successfully." : "Timetable slot added successfully.");
      setIsModalOpen(false);
      setEditingId(null);
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
              onClick={handleOpenCreate}
            >
              Schedule Class Slot
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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1 text-slate-400 hover:text-[#16466f] hover:bg-slate-100 rounded transition"
                                title="Edit Slot"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Delete Slot"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
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

      {/* Schedule / Edit Slot Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingId(null);
          }}
          title={editingId ? "Edit Class Slot" : "Schedule Class Slot"}
        >
          <form onSubmit={handleSaveEntry} className="space-y-4">
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
              placeholder="e.g. Physics - Electrostatics"
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
                placeholder="e.g. Room 101"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              />
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Quick Time Presets:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SLOTS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setFormData({ ...formData, start_time: p.start, end_time: p.end })}
                    className={`px-2.5 py-1 text-[11px] rounded-md border transition font-medium ${
                      formData.start_time === p.start && formData.end_time === p.end
                        ? "bg-[#16466f] text-white border-[#16466f]"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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
                Format: 24-hour clock (e.g. 09:00 for 9 AM, 14:00 for 2 PM, 16:30 for 4:30 PM).
              </p>
            </div>

            <Select
              label="Assigned Faculty"
              options={[
                { value: "", label: "No faculty assigned" },
                ...teachers.map((t) => ({ value: t.id, label: `${t.full_name} (${t.subject})` })),
              ]}
              value={formData.teacher_id}
              onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
            />

            {/* Real-time Conflict Alert */}
            {liveConflict ? (
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <span><b>Schedule Conflict Detected:</b> {liveConflict.message}</span>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Slot is available with no faculty or room overlaps on {formData.day_of_week}.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={Boolean(liveConflict) || !formData.subject.trim() || formData.start_time >= formData.end_time}
              >
                {editingId ? "Save Changes" : "Confirm & Schedule"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
