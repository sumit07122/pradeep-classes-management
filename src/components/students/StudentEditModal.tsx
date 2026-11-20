import React, { useState, useEffect } from "react";
import { Modal, Input, Select, Button } from "../common";
import { studentsService } from "../../services/studentsService";
import type { Student, StudentStatus } from "../../types";

interface StudentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: (updated: Student) => void;
}

const CLASSES = ["Class 12", "Class 11", "Class 10", "Class 9", "Dropper / Repeaters"];

export const StudentEditModal: React.FC<StudentEditModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Kota");
  const [className, setClassName] = useState(CLASSES[0]);
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelation, setParentRelation] = useState("Father");
  const [parentEmail, setParentEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [status, setStatus] = useState<StudentStatus>("Active");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (student && isOpen) {
      setFullName(student.full_name);
      setPhone(student.phone || "");
      setEmail(student.email || "");
      setDateOfBirth(student.date_of_birth || "");
      setGender(student.gender || "male");
      setAddress(student.address || "");
      setCity(student.city || "Kota");
      setClassName(student.class_name);
      setParentName(student.parent_name || "");
      setParentPhone(student.parent_phone || "");
      setParentRelation(student.parent_relation || "Father");
      setParentEmail(student.parent_email || "");
      setEmergencyContact(student.emergency_contact || "");
      setStatus(student.status);
      setNotes(student.notes || "");
      setError(null);
    }
  }, [student, isOpen]);

  if (!student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await studentsService.updateStudent(student.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      date_of_birth: dateOfBirth || undefined,
      gender,
      address: address.trim() || undefined,
      city: city.trim() || "Kota",
      class_name: className,
      parent_name: parentName.trim() || undefined,
      parent_phone: parentPhone.trim() || undefined,
      parent_relation: parentRelation,
      parent_email: parentEmail.trim() || undefined,
      emergency_contact: emergencyContact.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.error || !res.data) {
      setError(res.error || "Failed to update student profile.");
      return;
    }

    onSuccess(res.data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Profile: ${student.full_name}`}
      subtitle="STUDENT RECORD UPDATE"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Input
            label="Student Full Name *"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Student Mobile *"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Student Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
              >
                <option value="Active">Active</option>
                <option value="On hold">On hold</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Enrolled Class"
              options={CLASSES}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <Input
            label="Residential Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Parent / Guardian Name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
            />
            <Input
              label="Parent Mobile"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
