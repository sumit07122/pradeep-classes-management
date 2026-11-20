import React, { useState, useEffect } from "react";
import {
  Building2,
  MessageSquare,
  Save,
  Info,
} from "lucide-react";
import { Button, Input, Badge, LoadingSpinner, AlertNotice } from "../components/common";
import { settingsService } from "../services/settingsService";
import type { InstituteSettings, WhatsAppSettings } from "../types/settings";

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"profile" | "whatsapp">("profile");
  const [instituteSettings, setInstituteSettings] = useState<InstituteSettings | null>(null);
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [instRes, waRes] = await Promise.all([
        settingsService.getInstituteSettings(),
        settingsService.getWhatsAppSettings(),
      ]);
      setInstituteSettings(instRes.data);
      setWhatsappSettings(waRes.data);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load settings.");
    } finally {
      setLoading(false);
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
    return <LoadingSpinner label="Loading settings..." size="lg" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div>
        <div className="eyebrow">INSTITUTE SYSTEM CONFIGURATION</div>
        <h1 className="text-2xl font-extrabold text-[#102f50]">Institute Settings</h1>
        <p className="text-sm text-slate-500">
          Configure Pradeep Classes profile, academic standards, and Meta WhatsApp Cloud API credentials.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
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

      {activeTab === "profile" && instituteSettings && (
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
            <Input
              label="State / Pincode"
              value={`${instituteSettings.state || "Rajasthan"} - ${instituteSettings.pincode || "324005"}`}
              onChange={(e) => {
                const parts = e.target.value.split("-");
                setInstituteSettings({
                  ...instituteSettings,
                  state: parts[0]?.trim() || "Rajasthan",
                  pincode: parts[1]?.trim() || "324005",
                });
              }}
            />
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

      {activeTab === "whatsapp" && whatsappSettings && (
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
    </div>
  );
};
