import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Send,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Modal, Button, Badge } from "../common";
import { whatsappService } from "../../services/whatsappService";
import { useAuth } from "../../hooks/useAuth";
import type { WhatsAppSettings } from "../../types";

export interface NotificationTarget {
  student_id: string;
  student_name: string;
  batch_name?: string;
  date?: string;
  amount_due?: number;
  fee_title?: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_relation?: string;
  record_id?: string;
}

interface WhatsAppNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "absent_alert" | "fee_reminder";
  targets: NotificationTarget[];
  onSuccess: (sentCount: number) => void;
}

export const WhatsAppNotificationModal: React.FC<WhatsAppNotificationModalProps> = ({
  isOpen,
  onClose,
  type,
  targets,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [recipientPreference, setRecipientPreference] = useState<"parent" | "student">("parent");
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const isBulk = targets.length > 1;
  const single = targets[0] || null;

  useEffect(() => {
    if (isOpen) {
      loadSettingsAndCheckDuplicates();
    }
  }, [isOpen, targets]);

  const maskPhone = (phone?: string) => {
    if (!phone) return "No phone on file";
    const cleaned = phone.trim();
    if (cleaned.length <= 4) return cleaned;
    const first3 = cleaned.slice(0, 3);
    const last2 = cleaned.slice(-2);
    return `${first3}•••••${last2}`;
  };

  const loadSettingsAndCheckDuplicates = async () => {
    setLoadingSettings(true);
    setErrorNotice(null);
    setDuplicateWarning(null);

    try {
      const res = await whatsappService.getSettings();
      setSettings(res.data);

      // Check duplicates for single target
      if (single) {
        const eventType = type === "absent_alert" ? "attendance_absent" : "fee_due_reminder";
        const hasDup = await whatsappService.checkDuplicateNotification(
          single.student_id,
          eventType,
          type === "absent_alert" ? single.date : single.record_id
        );
        if (hasDup) {
          setDuplicateWarning(
            type === "absent_alert"
              ? `An absence notification was already queued/sent for ${single.student_name} today.`
              : `A fee reminder was already sent for this invoice in the last 3 days.`
          );
        }
      }
    } catch (err: any) {
      console.error("Error loading notification settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  if (!isOpen || targets.length === 0) return null;

  const isLiveConfigured = Boolean(
    settings?.is_enabled && settings?.phone_number_id && settings?.api_token
  );

  const getRecipientInfo = (target: NotificationTarget) => {
    if (recipientPreference === "parent" && target.parent_phone) {
      return {
        name: target.parent_name || `${target.student_name}'s Guardian`,
        phone: target.parent_phone,
        type: target.parent_relation || "Parent",
      };
    }
    return {
      name: target.student_name,
      phone: target.phone || target.parent_phone || "",
      type: "Student",
    };
  };

  const generateMessageBody = (target: NotificationTarget) => {
    const recipient = getRecipientInfo(target);
    if (type === "absent_alert") {
      return `Dear ${recipient.name}, this is an official absence alert from Pradeep Classes.\n\nStudent: ${target.student_name}\nBatch: ${target.batch_name || "Enrolled Batch"}\nDate: ${target.date || new Date().toISOString().split("T")[0]}\nStatus: ABSENT from class today.\n\nPlease contact institute administration for any leave notes or inquiries.`;
    } else {
      const formattedAmount = target.amount_due ? `₹${target.amount_due.toLocaleString("en-IN")}` : "Due";
      return `Dear ${recipient.name}, this is an official fee reminder from Pradeep Classes.\n\nStudent: ${target.student_name}\nOutstanding Dues: ${formattedAmount}\nFee Period: ${target.fee_title || "Academic Tuition Fee"}\n\nPlease arrange settlement at the coaching reception or via authorized UPI/Bank transfer.`;
    }
  };

  const handleConfirmSend = async () => {
    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      let sentCount = 0;

      if (type === "absent_alert") {
        const payload = targets.map((t) => {
          const rec = getRecipientInfo(t);
          return {
            student_id: t.student_id,
            student_name: t.student_name,
            batch_name: t.batch_name || "Batch",
            date: t.date || new Date().toISOString().split("T")[0],
            recipient_phone: rec.phone,
            recipient_name: rec.name,
            recipient_type: rec.type,
            reference_id: t.record_id,
            message_body: generateMessageBody(t),
            initiated_by: user?.id,
          };
        });

        const res = await whatsappService.sendBulkAbsentAlerts(payload);
        if (res.error) throw new Error(res.error);
        sentCount = res.queuedCount;
      } else {
        const payload = targets.map((t) => {
          const rec = getRecipientInfo(t);
          return {
            student_id: t.student_id,
            student_name: t.student_name,
            amount_due: t.amount_due || 0,
            fee_title: t.fee_title || "Tuition Fee",
            recipient_phone: rec.phone,
            recipient_name: rec.name,
            recipient_type: rec.type,
            reference_id: t.record_id,
            message_body: generateMessageBody(t),
            initiated_by: user?.id,
          };
        });

        const res = await whatsappService.sendBulkFeeReminders(payload);
        if (res.error) throw new Error(res.error);
        sentCount = res.queuedCount;
      }

      onSuccess(sentCount);
      onClose();
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to enqueue WhatsApp notifications");
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewTarget = single || targets[0];
  const previewRecipient = getRecipientInfo(previewTarget);
  const previewMessage = generateMessageBody(previewTarget);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        type === "absent_alert"
          ? isBulk
            ? `Send Absence WhatsApp Alerts (${targets.length} Students)`
            : `Send Absence Alert • ${single.student_name}`
          : isBulk
          ? `Send Bulk Fee Reminders (${targets.length} Students)`
          : `Send Fee Reminder • ${single.student_name}`
      }
    >
      <div className="space-y-4">
        {/* Status / Mode Notice */}
        {isLiveConfigured ? (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">WhatsApp Business Cloud API Active:</span>{" "}
              Messages will be queued and dispatched via verified Meta Cloud templates.
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Safe Test / Sandbox Mode Active:</span>{" "}
              WhatsApp API is not configured for live sending. Notifications will be recorded in the message queue and marked <code>skipped_test_mode</code> without sending live SMS/WhatsApp charges.
            </div>
          </div>
        )}

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Duplicate Alert Notice:</span> {duplicateWarning}
              <p className="text-[11px] text-rose-600 mt-0.5">
                Confirming below will log an explicit authorized re-dispatch.
              </p>
            </div>
          </div>
        )}

        {errorNotice && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorNotice}
          </div>
        )}

        {/* Recipient Preference */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Target Contact Channel:
          </label>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="recipientPref"
                value="parent"
                checked={recipientPreference === "parent"}
                onChange={() => setRecipientPreference("parent")}
                className="text-[#16466f]"
              />
              <span>Parent / Guardian Contact (Recommended)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="recipientPref"
                value="student"
                checked={recipientPreference === "student"}
                onChange={() => setRecipientPreference("student")}
                className="text-[#16466f]"
              />
              <span>Student Personal Phone</span>
            </label>
          </div>
        </div>

        {/* Single Target Recipient Display */}
        {!isBulk ? (
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-500">
              <span>Recipient:</span>
              <span className="font-bold text-slate-800">
                {previewRecipient.name} ({previewRecipient.type})
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Masked Phone:</span>
              <span className="font-mono font-bold text-[#16466f]">
                {maskPhone(previewRecipient.phone)}
              </span>
            </div>
            {type === "absent_alert" ? (
              <div className="flex justify-between items-center text-slate-500">
                <span>Absence Date:</span>
                <span className="font-medium text-slate-700">{single.date}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-slate-500">
                <span>Verified Balance Due:</span>
                <span className="font-bold text-rose-600">
                  ₹{(single.amount_due || 0).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Bulk Target Summary */
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">Selected Recipients:</span>
              <Badge variant="blue" size="sm">
                {targets.length} Total Students
              </Badge>
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-[11px]">
              {targets.map((t) => {
                const rec = getRecipientInfo(t);
                return (
                  <div key={t.student_id} className="py-1.5 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800">{t.student_name}</span>
                      <span className="text-slate-400 text-[10px] ml-1.5">({rec.type})</span>
                    </div>
                    <span className="font-mono text-slate-500">{maskPhone(rec.phone)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Message Preview */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Message Template Preview {isBulk && "(Sample shown for first student)"}:
          </label>
          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs whitespace-pre-line leading-relaxed shadow-inner">
            {previewMessage}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            Initiated by: <b>{user?.full_name || "Staff"}</b>
          </span>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isSubmitting || loadingSettings}
              disabled={loadingSettings}
              icon={<Send size={13} />}
              onClick={handleConfirmSend}
            >
              {isBulk ? `Queue ${targets.length} Messages` : "Confirm & Queue"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
