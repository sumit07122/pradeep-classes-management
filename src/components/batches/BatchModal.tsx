import React, { useState, useEffect } from "react";
import { Modal, Input, Select, Button } from "../common";
import type { Batch, BatchStatus } from "../../types";

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (batchData: Partial<Batch>) => Promise<boolean>;
  initialData?: Batch | null;
}

const COURSES = [
  "JEE Advanced",
  "NEET Medical",
  "Foundation 10th",
  "Foundation 9th",
  "Board Prep 12th",
  "Board Prep 11th",
  "Crash Course",
];

export const BatchModal: React.FC<BatchModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState(COURSES[0]);
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [maxCapacity, setMaxCapacity] = useState(40);
  const [timing, setTiming] = useState("08:00 AM - 11:30 AM");
  const [roomNumber, setRoomNumber] = useState("Room 101");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<BatchStatus>("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCourseName(initialData.course_name);
      setAcademicYear(initialData.academic_year || "2026-2027");
      setMaxCapacity(initialData.max_capacity || 40);
      setTiming(initialData.timing || "");
      setRoomNumber(initialData.room_number || "");
      setStartDate(initialData.start_date || "");
      setEndDate(initialData.end_date || "");
      setStatus(initialData.status || "active");
    } else {
      setName("");
      setCourseName(COURSES[0]);
      setAcademicYear("2026-2027");
      setMaxCapacity(40);
      setTiming("08:00 AM - 11:30 AM");
      setRoomNumber("Room 101");
      setStartDate("");
      setEndDate("");
      setStatus("active");
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Batch name is required.");
      return;
    }
    if (maxCapacity < 1) {
      setError("Maximum capacity must be at least 1 student.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: Partial<Batch> = {
      name: name.trim(),
      course_name: courseName,
      academic_year: academicYear.trim(),
      max_capacity: Number(maxCapacity),
      timing: timing.trim() || undefined,
      room_number: roomNumber.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status,
      is_active: status === "active",
    };

    const success = await onSave(payload);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Batch: ${initialData?.name}` : "Create New Learning Batch"}
      subtitle="ACADEMIC GROUP CONFIGURATION"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Batch Name *"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. JEE Morning Advanced 2027"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Target Course *"
            options={COURSES}
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
          />

          <Input
            label="Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026-2027"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Max Capacity *"
            type="number"
            min={1}
            max={200}
            required
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 1)}
          />

          <Input
            label="Class Timing"
            value={timing}
            onChange={(e) => setTiming(e.target.value)}
            placeholder="08:00 AM - 11:30 AM"
          />

          <Input
            label="Room / Hall"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="Room 101"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="Target End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Batch Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BatchStatus)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
            >
              <option value="active">Active (Enrolling & Ongoing)</option>
              <option value="completed">Completed (Curriculum Finished)</option>
              <option value="archived">Archived (Inactive)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isEditing ? "Save Changes" : "Create Batch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
