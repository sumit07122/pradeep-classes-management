import React, { useState, useEffect } from "react";
import {
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { Modal, Input, Select, Button } from "../common";
import { studentsService, type LiveBatchOption } from "../../services/studentsService";
import { userService } from "../../services/userService";
import { generateSecurePassword } from "../users/UserManagementTab";
import { CredentialsModal, type CredentialsInfo } from "../users/CredentialsModal";
import type { Student } from "../../types";

interface AdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: Student) => void;
}

const CLASSES = ["Class 12", "Class 11", "Class 10", "Class 9", "Dropper / Repeaters"];

export const AdmissionModal: React.FC<AdmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [batches, setBatches] = useState<LiveBatchOption[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Student Info
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Mathura");

  // Academic & Batch
  const [className, setClassName] = useState(CLASSES[0]);
  const [selectedBatchId, setSelectedBatchId] = useState("");

  // Guardian Details
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelation, setParentRelation] = useState("Father");
  const [parentEmail, setParentEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");

  // Portal Access Login Account
  const [generateLogin, setGenerateLogin] = useState(true);
  const [tempPassword, setTempPassword] = useState(() => generateSecurePassword(10));
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CredentialsInfo | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBatches();
      setTempPassword(generateSecurePassword(10));
    }
  }, [isOpen]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    const list = await studentsService.getLiveBatches();
    setBatches(list);
    if (list.length > 0 && !selectedBatchId) {
      const firstAvailable = list.find((b) => b.is_available) || list[0];
      setSelectedBatchId(firstAvailable.id);
    }
    setLoadingBatches(false);
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

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setDateOfBirth("");
    setGender("male");
    setAddress("");
    setCity("Mathura");
    setClassName(CLASSES[0]);
    setParentName("");
    setParentPhone("");
    setParentRelation("Father");
    setParentEmail("");
    setEmergencyContact("");
    setNotes("");
    setGenerateLogin(true);
    setTempPassword(generateSecurePassword(10));
    setShowPassword(false);
    setCopiedPassword(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Student full name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Student contact phone is required.");
      return;
    }
    if (generateLogin && (!tempPassword || tempPassword.length < 6)) {
      setError("Portal temporary password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const chosenBatch = batches.find((b) => b.id === selectedBatchId);

    const res = await studentsService.createStudent({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      date_of_birth: dateOfBirth || undefined,
      gender,
      address: address.trim() || undefined,
      city: city.trim() || "Mathura",
      class_name: className,
      batch_id: selectedBatchId || undefined,
      batch_name: chosenBatch?.name || undefined,
      parent_name: parentName.trim() || undefined,
      parent_phone: parentPhone.trim() || undefined,
      parent_relation: parentRelation,
      parent_email: parentEmail.trim() || undefined,
      emergency_contact: emergencyContact.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (res.error || !res.data) {
      setIsSubmitting(false);
      setError(res.error || "Failed to create student admission record.");
      return;
    }

    const createdStudent = res.data;

    if (generateLogin) {
      const userRes = await userService.createInstituteUser({
        full_name: createdStudent.full_name,
        email: createdStudent.email || undefined,
        phone: createdStudent.phone || parentPhone.trim() || undefined,
        password: tempPassword,
        role: "student",
        student_id: createdStudent.id,
      });

      setIsSubmitting(false);

      if (userRes.error || !userRes.data) {
        // Enrolled student successfully, but portal user creation returned error
        setError(
          `Student enrolled with Admission ID ${createdStudent.admission_no}, but creating portal login failed: ${userRes.error || "Unknown error"}. You can provision credentials manually from Settings > User Accounts.`
        );
        onSuccess(createdStudent);
        return;
      }

      // Notify parent page of the newly enrolled student
      onSuccess(createdStudent);

      // Present clean Credentials modal
      setCreatedCredentials({
        name: createdStudent.full_name,
        username:
          userRes.data.email ||
          (createdStudent.email ||
            `${createdStudent.admission_no.toLowerCase()}@pradeepclasses.in`),
        password: tempPassword,
        phone: createdStudent.phone || parentPhone.trim() || undefined,
        role: "student",
        isReset: false,
      });
    } else {
      setIsSubmitting(false);
      onSuccess(createdStudent);
      resetForm();
      onClose();
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !createdCredentials}
        onClose={onClose}
        title="Student Admission & Registration"
        subtitle="NEW STUDENT ENROLLMENT"
      >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Section 1: Personal Details */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#16466f] text-white flex items-center justify-center text-[10px]">
              1
            </span>
            Student Personal Information
          </h4>

          <div className="space-y-3">
            <Input
              label="Full Name *"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rohan Sharma"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Student Mobile Phone *"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />

              <Input
                label="Student Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rohan@example.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Date of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender
                </label>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Residential Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street / Colony / Landmark"
                />
              </div>
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Mathura"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Academic & Batch */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#16466f] text-white flex items-center justify-center text-[10px]">
              2
            </span>
            Academic Level & Learning Batch
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Enrolled Class *"
              options={CLASSES}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Batch (Live Capacity) *
              </label>
              {loadingBatches ? (
                <div className="h-10 px-3 flex items-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                  Loading live batches...
                </div>
              ) : batches.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  No active batches found. Please create a batch first.
                </div>
              ) : (
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id} disabled={!b.is_available}>
                      {b.name} — ({b.enrolled_count}/{b.max_capacity} Seats
                      {!b.is_available ? " • FULL" : ""})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Guardian Details */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#16466f] text-white flex items-center justify-center text-[10px]">
              3
            </span>
            Parent / Guardian Details
          </h4>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Parent / Guardian Name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relationship
                </label>
                <select
                  value={parentRelation}
                  onChange={(e) => setParentRelation(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:border-[#16466f]"
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Legal Guardian</option>
                  <option value="Sibling">Elder Sibling</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Parent Mobile Phone"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+91 98765 00000"
              />

              <Input
                label="Parent Email"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="rajesh.sharma@example.com"
              />
            </div>

            <Input
              label="Emergency Contact Phone"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Alternative phone number"
            />
          </div>
        </div>

        {/* Section 4: Student Portal Login Account */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#16466f] text-white flex items-center justify-center text-[10px]">
              4
            </span>
            Portal Access & Login Account
          </h4>

          <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-100 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="generate-student-login-toggle"
                type="checkbox"
                checked={generateLogin}
                onChange={(e) => setGenerateLogin(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#16466f] focus:ring-[#16466f]"
              />
              <div>
                <span className="text-xs font-bold text-[#1c3045] flex items-center gap-1.5">
                  <KeyRound size={14} className="text-[#16466f]" />
                  Generate Student Portal Login Account
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Creates active portal credentials so the student can access notes, tests, and homework immediately.
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
                      type={showPassword ? "text" : "password"}
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Temporary password"
                      className="font-mono text-xs pr-10"
                      required={generateLogin}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setTempPassword(generateSecurePassword(10))}
                    icon={<RefreshCw size={13} />}
                    title="Generate new random password"
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

                <p className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1">
                  <Sparkles size={13} className="text-amber-500 shrink-0" />
                  <span>
                    {email.trim()
                      ? `Student username will be ${email.trim()}`
                      : "If student email is omitted, username defaults to {admission_no}@pradeepclasses.in."}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Confirm Admission & Generate ID
          </Button>
        </div>
      </form>
    </Modal>

    <CredentialsModal
      isOpen={Boolean(createdCredentials)}
      onClose={() => {
        setCreatedCredentials(null);
        resetForm();
        onClose();
      }}
      credentials={createdCredentials}
      whatsAppButtonLabel="Send Welcome WhatsApp to Student / Parent"
      title="Student Portal Login Provisioned"
      subtitle="STUDENT CREDENTIAL DISPATCH"
    />
    </>
  );
};
