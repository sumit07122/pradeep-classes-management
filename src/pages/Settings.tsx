import React, { useState, useEffect } from "react";
import {
  Building2,
  MessageSquare,
  Save,
  Info,
  User,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Users,
  Database,
  X,
} from "lucide-react";
import { Button, Input, Badge, LoadingSpinner, AlertNotice } from "../components/common";
import { settingsService } from "../services/settingsService";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { InstituteSettings, WhatsAppSettings } from "../types/settings";
import { UserManagementTab } from "../components/users/UserManagementTab";
import { BackupAndRecoveryTab } from "../components/settings/BackupAndRecoveryTab";

export const Settings: React.FC<{ initialLoading?: boolean }> = ({
  initialLoading = true,
}) => {
  const { role, user, isOwner, isAdmin, isSuperAdmin } = useAuth();
  const isManagement = Boolean(
    isOwner ||
    isAdmin ||
    isSuperAdmin ||
    ["super_admin", "owner", "admin"].includes(role || "")
  );

  const [activeTab, setActiveTab] = useState<"my-profile" | "profile" | "whatsapp" | "users" | "backup">(
    "my-profile"
  );

  const [instituteSettings, setInstituteSettings] = useState<InstituteSettings | null>(null);
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings | null>(null);

  // Personal Profile State
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [linkedDetails, setLinkedDetails] = useState<any | null>(null);

  // Security / Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [hasChangedPassword, setHasChangedPassword] = useState(() => {
    if (typeof window !== "undefined" && user?.id) {
      return localStorage.getItem(`pc_pwd_changed_${user.id}`) === "true";
    }
    return false;
  });

  const [loading, setLoading] = useState(initialLoading);
  const [isSaving, setIsSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (user) {
        setFullName(user.full_name || "");
        setPhone(user.phone || "");

        // If student or teacher, load their profile details
        if (role === "student" && supabase) {
          const { data: sData } = await supabase
            .from("students")
            .select("*, batches(name, course_name)")
            .eq("profile_id", user.id)
            .maybeSingle();
          if (sData) setLinkedDetails(sData);
        } else if (role === "teacher" && supabase) {
          const { data: tData } = await supabase
            .from("teachers")
            .select("*")
            .eq("profile_id", user.id)
            .maybeSingle();
          if (tData) setLinkedDetails(tData);
        }
      }

      if (isManagement) {
        const [instRes, waRes] = await Promise.all([
          settingsService.getInstituteSettings(),
          settingsService.getWhatsAppSettings(),
        ]);
        setInstituteSettings(instRes.data);
        setWhatsappSettings(waRes.data);
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supabase) return;

    setIsSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;
      setSuccessNotice("Personal profile details updated successfully!");
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorNotice("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorNotice("Passwords do not match.");
      return;
    }

    if (!supabase) return;

    setIsUpdatingPassword(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      if (user?.id) {
        localStorage.setItem(`pc_pwd_changed_${user.id}`, "true");
        setHasChangedPassword(true);
      }
      setSuccessNotice("Your password has been changed securely.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveInstituteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteSettings) return;

    setIsSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const res = await settingsService.updateInstituteSettings({
      institute_name: instituteSettings.institute_name,
      tagline: instituteSettings.tagline,
      phone: instituteSettings.phone,
      email: instituteSettings.email,
      address: instituteSettings.address,
      city: instituteSettings.city,
      state: instituteSettings.state,
      pincode: instituteSettings.pincode,
      website: instituteSettings.website,
      academic_year: instituteSettings.academic_year,
      default_pass_percentage: Number(instituteSettings.default_pass_percentage),
      fee_late_fine_daily: Number(instituteSettings.fee_late_fine_daily),
      currency_symbol: instituteSettings.currency_symbol || "₹",
      receipt_prefix: instituteSettings.receipt_prefix || "REC",
      invoice_prefix: instituteSettings.invoice_prefix || "INV",
      terms_and_conditions: instituteSettings.terms_and_conditions || "",
    });

    setIsSaving(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("Institute profile updated successfully.");
      setInstituteSettings(res.data);
    }
  };

  const handleSaveWhatsAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappSettings) return;

    setIsSaving(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const res = await settingsService.updateWhatsAppSettings({
      is_enabled: whatsappSettings.is_enabled,
      phone_number_id: whatsappSettings.phone_number_id,
      waba_id: whatsappSettings.waba_id,
      access_token: whatsappSettings.access_token,
      test_mode: whatsappSettings.test_mode,
      verified_number: whatsappSettings.verified_number,
      send_present_alert: whatsappSettings.send_present_alert,
      send_absent_alert: whatsappSettings.send_absent_alert,
      send_late_alert: whatsappSettings.send_late_alert,
      send_leave_alert: whatsappSettings.send_leave_alert,
      send_fee_receipt_alert: whatsappSettings.send_fee_receipt_alert,
      send_exam_result_alert: whatsappSettings.send_exam_result_alert,
    });

    setIsSaving(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice("WhatsApp Cloud API configuration saved.");
      setWhatsappSettings(res.data);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading settings & profile..." size="lg" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div>
        <div className="eyebrow">
          {isManagement ? "INSTITUTE SYSTEM & PROFILE" : "USER ACCOUNT & PROFILE"}
        </div>
        <h1 className="text-2xl font-extrabold text-[#102f50]">
          {isManagement ? "Settings & Profile" : "My Profile & Account Settings"}
        </h1>
        <p className="text-sm text-slate-500">
          {isManagement
            ? "Configure Pradeep Classes profile, academic standards, credentials, and manage your account."
            : "Manage your personal profile, credentials, security, and linked institute records."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("my-profile")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "my-profile"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User size={17} />
          My Profile & Security
        </button>

        {isManagement && (
          <>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "users"
                  ? "border-[#16466f] text-[#16466f]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users size={17} />
              User Accounts & Logins
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "profile"
                  ? "border-[#16466f] text-[#16466f]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 size={17} />
              Institute Profile & Academics
            </button>
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "whatsapp"
                  ? "border-[#16466f] text-[#16466f]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <MessageSquare size={17} />
              WhatsApp Cloud API Integration
            </button>
            {role === "super_admin" && (
              <button
                onClick={() => setActiveTab("backup")}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                  activeTab === "backup"
                    ? "border-[#16466f] text-[#16466f]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Database size={17} />
                Backup & Crisis Recovery
              </button>
            )}
          </>
        )}
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

      {/* TAB 1: My Personal Profile & Security */}
      {activeTab === "my-profile" && (
        <div className="space-y-6">
          <form
            onSubmit={handleSavePersonalProfile}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5"
          >
            <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Personal Identification</h3>
                <p className="text-xs text-slate-500">
                  Your registered account details on Pradeep Classes Management Platform.
                </p>
              </div>
              <Badge
                variant={
                  role === "super_admin"
                    ? "violet"
                    : role === "owner"
                    ? "amber"
                    : role === "admin"
                    ? "info"
                    : role === "teacher"
                    ? "warning"
                    : "neutral"
                }
                size="md"
              >
                {role.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                required
                disabled={role === "student"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Login Username / Identifier"
                disabled
                value={
                  role === "student"
                    ? (linkedDetails?.admission_no || "PC-Student")
                    : role === "teacher"
                    ? (linkedDetails?.full_name || user?.full_name || "Faculty")
                    : (user?.email || "admin")
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Contact Phone"
                placeholder="+91 98765 43210"
                disabled={role === "student"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="Institute / Branch"
                disabled
                value="Pradeep Classes (Main Campus)"
              />
            </div>

            {role === "student" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Student Identity Protected:</strong> Your registered name, admission records, and phone contact are permanently locked. Please contact the institute admin for any official corrections.
                </span>
              </div>
            )}

            {/* If Student: Show Academic Info */}
            {role === "student" && linkedDetails && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm mb-1">
                  <GraduationCap size={16} className="text-[#16466f]" />
                  Enrolled Student Records
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission No</span>
                    <b className="font-mono">{linkedDetails.admission_no || "N/A"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Enrolled Batch</span>
                    <b>{linkedDetails.batches?.name || "Assigned Batch"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Parent / Emergency Phone</span>
                    <b>{linkedDetails.parent_phone || "Not set"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Academic Status</span>
                    <Badge variant={linkedDetails.status === "active" ? "success" : "neutral"} size="sm">
                      {linkedDetails.status || "Active"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* If Teacher: Show Faculty Info */}
            {role === "teacher" && linkedDetails && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm mb-1">
                  <Users size={16} className="text-[#16466f]" />
                  Faculty Profile
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Specialization</span>
                    <b>{linkedDetails.specialization || "Senior Faculty"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Qualifications</span>
                    <b>{linkedDetails.qualification || "M.Sc., B.Ed."}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Faculty Status</span>
                    <Badge variant="success" size="sm">Active Faculty</Badge>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
                disabled={role === "student"}
                icon={<Save size={16} />}
              >
                Save Profile Details
              </Button>
            </div>
          </form>

          {/* Security & Password Reset */}
          <form
            onSubmit={handleUpdatePassword}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4"
          >
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <KeyRound size={18} className="text-[#16466f]" />
              <div>
                <h3 className="font-bold text-slate-800 text-base">Account Security & Password</h3>
                <p className="text-xs text-slate-500">Update your login credentials securely.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="secondary"
                isLoading={isUpdatingPassword}
                icon={<ShieldCheck size={16} />}
              >
                Update Password
              </Button>
            </div>

            {/* Assistance & Administration Desk (Only for non-management students/teachers who haven't changed password yet) */}
            {!isManagement &&
              !isOwner &&
              !isAdmin &&
              !isSuperAdmin &&
              role !== "owner" &&
              role !== "admin" &&
              role !== "super_admin" &&
              role !== "accountant" &&
              !user?.email?.toLowerCase().includes("admin@") &&
              !hasChangedPassword && (
              <div className="mt-4 p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-start gap-3 text-xs text-amber-900 relative">
                <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 pr-6">
                  <span className="font-bold block">Need Credentials Assistance or Forgot Password?</span>
                  <p className="text-amber-800 leading-relaxed">
                    Default password for all students and faculty accounts is <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-950">PRADEEPCLASSES</code>.
                    If you forgot your password or need an immediate reset, please contact the Coaching Administration Desk:
                  </p>
                  <div className="flex flex-wrap gap-4 pt-1 font-semibold text-amber-900">
                    <span>📞 Call / WhatsApp: +91 8126180408</span>
                    <span>📍 Reception Desk: Pradeep Classes Administrative Block</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (user?.id) localStorage.setItem(`pc_pwd_changed_${user.id}`, "true");
                    setHasChangedPassword(true);
                  }}
                  className="absolute top-2.5 right-2.5 text-amber-700 hover:text-amber-950 p-1 rounded"
                  title="Dismiss notice"
                  aria-label="Dismiss notice"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: Institute Profile & Academics */}
      {activeTab === "profile" && isManagement && instituteSettings && (
        <form onSubmit={handleSaveInstituteSettings} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800 text-base">Institute Identification</h3>
            <p className="text-xs text-slate-500">Official information shown on invoices, report cards, and receipts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Institute Name"
              required
              value={instituteSettings.institute_name}
              onChange={(e) => setInstituteSettings({ ...instituteSettings, institute_name: e.target.value })}
            />
            <Input
              label="Tagline / Motto"
              value={instituteSettings.tagline || ""}
              onChange={(e) => setInstituteSettings({ ...instituteSettings, tagline: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Official Phone"
              value={instituteSettings.phone || ""}
              onChange={(e) => setInstituteSettings({ ...instituteSettings, phone: e.target.value })}
            />
            <Input
              label="Official Email"
              type="email"
              value={instituteSettings.email || ""}
              onChange={(e) => setInstituteSettings({ ...instituteSettings, email: e.target.value })}
            />
            <Input
              label="Public Website"
              value={instituteSettings.website || ""}
              onChange={(e) => setInstituteSettings({ ...instituteSettings, website: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Campus Address"
                value={instituteSettings.address || ""}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, address: e.target.value })}
              />
            </div>
            <Input
              label="City"
              value={instituteSettings.city || ""}
              onChange={(e) => setInstituteSettings({ ...instituteSettings, city: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="State"
                placeholder="e.g. Maharashtra"
                value={instituteSettings.state || ""}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, state: e.target.value })}
              />
              <Input
                label="Pincode"
                placeholder="e.g. 400001"
                value={instituteSettings.pincode || ""}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, pincode: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="font-bold text-slate-800 text-base mb-1">Academic & Financial Rules</h3>
            <p className="text-xs text-slate-500 mb-4">Default standards for grading calculations and late fee collections.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Current Academic Session"
                value={instituteSettings.academic_year}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, academic_year: e.target.value })}
              />
              <Input
                label="Passing Percentage Threshold (%)"
                type="number"
                value={instituteSettings.default_pass_percentage}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, default_pass_percentage: Number(e.target.value) })}
              />
              <Input
                label="Daily Late Fee Fine (INR)"
                type="number"
                value={instituteSettings.fee_late_fine_daily}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, fee_late_fine_daily: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Input
                label="Receipt Prefix"
                placeholder="e.g. REC or PC-REC-"
                value={instituteSettings.receipt_prefix || ""}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, receipt_prefix: e.target.value })}
              />
              <Input
                label="Invoice Prefix"
                placeholder="e.g. INV or PC-INV-"
                value={instituteSettings.invoice_prefix || ""}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, invoice_prefix: e.target.value })}
              />
              <Input
                label="Currency Symbol"
                placeholder="e.g. ₹"
                value={instituteSettings.currency_symbol || "₹"}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, currency_symbol: e.target.value })}
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Terms & Conditions / Institute Notice
              </label>
              <textarea
                rows={3}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:border-[#16466f] focus:outline-none focus:ring-1 focus:ring-[#16466f]"
                placeholder="e.g. Fees once paid are non-refundable. Minimum 75% attendance required."
                value={instituteSettings.terms_and_conditions || ""}
                onChange={(e) => setInstituteSettings({ ...instituteSettings, terms_and_conditions: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              icon={<Save size={16} />}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      )}

      {/* TAB 3: WhatsApp Cloud API */}
      {activeTab === "whatsapp" && isManagement && whatsappSettings && (
        <form onSubmit={handleSaveWhatsAppSettings} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Meta WhatsApp Cloud API Configuration</h3>
              <p className="text-xs text-slate-500">Official business messaging credentials and asynchronous dispatch settings.</p>
            </div>
            <Badge variant={whatsappSettings.test_mode ? "amber" : "green"} size="lg">
              {whatsappSettings.test_mode ? "Test Mode (Safe Sandbox)" : "Production Live"}
            </Badge>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
            <Info size={16} className="text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong>Asynchronous Reliable Queue Architecture:</strong>
              <p className="leading-relaxed">
                When attendance is marked, messages are stored in <code>whatsapp_message_queue</code>.
                In <b>Test Mode</b>, messages are marked as <code>skipped_test_mode</code> without making external HTTP calls, allowing full testing of attendance workflows without live API keys.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappSettings.test_mode}
                onChange={(e) => setWhatsappSettings({ ...whatsappSettings, test_mode: e.target.checked })}
                className="w-4 h-4 text-[#16466f] rounded border-slate-300 focus:ring-[#16466f]"
              />
              <span className="text-sm font-bold text-slate-800">
                Enable Test Mode (Prevents external HTTP requests; logs delivery in local queue)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappSettings.is_enabled}
                onChange={(e) => setWhatsappSettings({ ...whatsappSettings, is_enabled: e.target.checked })}
                className="w-4 h-4 text-[#16466f] rounded border-slate-300 focus:ring-[#16466f]"
              />
              <span className="text-sm font-bold text-slate-800">
                Activate Automatic Notifications System
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="WhatsApp Phone Number ID"
              placeholder="e.g. 104829104829102"
              value={whatsappSettings.phone_number_id || ""}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, phone_number_id: e.target.value })}
            />
            <Input
              label="WhatsApp Business Account ID (WABA ID)"
              placeholder="e.g. 10394820194829"
              value={whatsappSettings.waba_id || ""}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, waba_id: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Permanent System User Access Token"
              type="password"
              placeholder="EAAG...."
              value={whatsappSettings.access_token || ""}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, access_token: e.target.value })}
            />
            <Input
              label="Verified Sender Phone Number"
              placeholder="+91 98765 43210"
              value={whatsappSettings.verified_number || ""}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, verified_number: e.target.value })}
            />
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h4 className="font-bold text-slate-800 text-sm mb-3">Automated Trigger Events</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={whatsappSettings.send_present_alert}
                  onChange={(e) => setWhatsappSettings({ ...whatsappSettings, send_present_alert: e.target.checked })}
                  className="rounded border-slate-300 text-[#16466f]"
                />
                <span>Send WhatsApp message on <b>PRESENT</b> attendance</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={whatsappSettings.send_absent_alert}
                  onChange={(e) => setWhatsappSettings({ ...whatsappSettings, send_absent_alert: e.target.checked })}
                  className="rounded border-slate-300 text-[#16466f]"
                />
                <span>Send WhatsApp alert on <b>ABSENT</b> attendance</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={whatsappSettings.send_late_alert}
                  onChange={(e) => setWhatsappSettings({ ...whatsappSettings, send_late_alert: e.target.checked })}
                  className="rounded border-slate-300 text-[#16466f]"
                />
                <span>Send WhatsApp alert on <b>LATE</b> arrival</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={whatsappSettings.send_fee_receipt_alert}
                  onChange={(e) => setWhatsappSettings({ ...whatsappSettings, send_fee_receipt_alert: e.target.checked })}
                  className="rounded border-slate-300 text-[#16466f]"
                />
                <span>Send receipt confirmation on fee payment</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              icon={<Save size={16} />}
            >
              Save WhatsApp Settings
            </Button>
          </div>
        </form>
      )}

      {/* TAB 4: User Accounts & Logins (Admin, Owner, Super Admin) */}
      {isManagement && activeTab === "users" && (
        <UserManagementTab />
      )}

      {/* TAB 5: Backup, Crisis Recovery & Clean Handover (Super Admin Platform Only) */}
      {role === "super_admin" && isManagement && activeTab === "backup" && (
        <BackupAndRecoveryTab />
      )}
    </div>
  );
};
