import React, { useState, useEffect } from "react";
import {
  Bell,
  MessageSquare,
  Plus,
  Send,
  RotateCw,
  Phone,
  ShieldCheck,
  RefreshCw,
  Edit2,
  Trash2,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Cake,
  Receipt,
  BookOpen,
} from "lucide-react";
import { Button, Input, Select, Badge, LoadingSpinner, AlertNotice, Modal } from "../components/common";
import { announcementsService } from "../services/announcementsService";
import { whatsappService } from "../services/whatsappService";
import { whatsappAutomationService, type AutomationExecutionResult } from "../services/whatsappAutomationService";
import { batchesService } from "../services/batchesService";
import { useAuth } from "../hooks/useAuth";
import type { Announcement, WhatsAppMessageQueueItem } from "../types/communication";
import type { Batch } from "../types";

export const Announcements: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<"broadcasts" | "whatsapp_queue" | "automations">("broadcasts");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [queueItems, setQueueItems] = useState<WhatsAppMessageQueueItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Automations Hub State
  const [runningAutomation, setRunningAutomation] = useState<string | null>(null);
  const [automationLog, setAutomationLog] = useState<AutomationExecutionResult | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Announcement Form State
  const [form, setForm] = useState<{
    title: string;
    message: string;
    target_role: string;
    priority: "normal" | "urgent" | "announcement";
    batch_id: string;
  }>({
    title: "",
    message: "",
    target_role: "all",
    priority: "normal",
    batch_id: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingId, setIsRetryingId] = useState<string | null>(null);

  // WhatsApp Dispatch Form & Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [editingDispatchId, setEditingDispatchId] = useState<string | null>(null);
  const [whatsappForm, setWhatsappForm] = useState<{
    recipient_phone: string;
    recipient_name: string;
    event_type: string;
    message_body: string;
  }>({
    recipient_phone: "",
    recipient_name: "",
    event_type: "announcement",
    message_body: "",
  });
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

  const handleExecuteAutomation = async (
    name: string,
    action: () => Promise<AutomationExecutionResult>
  ) => {
    setRunningAutomation(name);
    setErrorNotice(null);
    setSuccessNotice(null);
    try {
      const res = await action();
      setAutomationLog(res);
      if (res.error) {
        setErrorNotice(`${res.automationName}: ${res.error}`);
      } else {
        setSuccessNotice(`${res.automationName}: ${res.details}`);
        // If items were queued, reload queue in background
        if (res.queuedCount > 0) {
          whatsappService.getMessageQueue().then((qRes) => setQueueItems(qRes.data));
        }
      }
    } catch (err: any) {
      setErrorNotice(err.message || `Failed to execute ${name}`);
    } finally {
      setRunningAutomation(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "broadcasts") {
        const [aRes, bRes] = await Promise.all([
          announcementsService.getAnnouncements(),
          batchesService.getBatches(),
        ]);
        setAnnouncements(aRes.data);
        setBatches(bRes.data);
      } else {
        const qRes = await whatsappService.getMessageQueue();
        setQueueItems(qRes.data);
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load communication data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      message: "",
      target_role: "all",
      priority: "normal",
      batch_id: "",
    });
    setIsModalOpen(true);
  };

  const handleStartEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setForm({
      title: ann.title,
      message: ann.message,
      target_role: ann.target_role || "all",
      priority: (ann.priority as any) || "normal",
      batch_id: ann.batch_id || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this announcement?")) {
      return;
    }
    setDeletingId(id);
    setErrorNotice(null);
    const res = await announcementsService.deleteAnnouncement(id);
    setDeletingId(null);
    if (res.success) {
      setSuccessNotice("Announcement removed successfully.");
      loadData();
    } else {
      setErrorNotice(res.error || "Failed to delete announcement.");
    }
  };

  const handleCreateOrUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.message) {
      setErrorNotice("Title and message body are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    let res;
    if (editingId) {
      res = await announcementsService.updateAnnouncement(editingId, {
        title: form.title,
        message: form.message,
        target_role: form.target_role,
        priority: form.priority,
        batch_id: form.batch_id || null,
      });
    } else {
      res = await announcementsService.createAnnouncement({
        title: form.title,
        message: form.message,
        target_role: form.target_role,
        priority: form.priority,
        batch_id: form.batch_id || null,
      });
    }

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice(
        editingId
          ? "Announcement updated successfully."
          : "Announcement broadcasted successfully."
      );
      setIsModalOpen(false);
      setEditingId(null);
      setForm({
        title: "",
        message: "",
        target_role: "all",
        priority: "normal",
        batch_id: "",
      });
      loadData();
    }
  };

  const [isDispatching, setIsDispatching] = useState(false);

  const handleRetryMessage = async (msgId: string) => {
    setIsRetryingId(msgId);
    const res = await whatsappService.retryMessage(msgId);
    setIsRetryingId(null);
    if (res.success) {
      setSuccessNotice("Message queued for immediate redelivery.");
      loadData();
    } else {
      setErrorNotice(res.error || "Retry failed.");
    }
  };

  const handleDispatchQueue = async () => {
    setIsDispatching(true);
    const res = await whatsappService.dispatchQueue();
    setIsDispatching(false);
    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice(`WhatsApp queue processed (${res.processed} notifications dispatched).`);
      loadData();
    }
  };

  const handleOpenCreateWhatsAppDispatch = () => {
    setEditingDispatchId(null);
    setWhatsappForm({
      recipient_phone: "",
      recipient_name: "",
      event_type: "manual_broadcast",
      message_body: "",
    });
    setIsWhatsAppModalOpen(true);
  };

  const handleStartEditWhatsAppDispatch = (item: WhatsAppMessageQueueItem) => {
    setEditingDispatchId(item.id);
    setWhatsappForm({
      recipient_phone: item.phone_number,
      recipient_name: item.student_name || "",
      event_type: item.message_type || "manual_broadcast",
      message_body: item.message_body,
    });
    setIsWhatsAppModalOpen(true);
  };

  const handleDeleteWhatsAppDispatch = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this WhatsApp dispatch from queue?")) {
      return;
    }
    setErrorNotice(null);
    const res = await whatsappService.deleteQueueItem(id);
    if (res.success) {
      setSuccessNotice("WhatsApp dispatch deleted successfully.");
      loadData();
    } else {
      setErrorNotice(res.error || "Failed to delete WhatsApp dispatch.");
    }
  };

  const handleCreateOrUpdateWhatsAppDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappForm.recipient_phone.trim()) {
      setErrorNotice("Recipient phone number is required.");
      return;
    }
    if (!whatsappForm.message_body.trim()) {
      setErrorNotice("Message body cannot be empty.");
      return;
    }

    setIsSubmittingDispatch(true);
    setErrorNotice(null);

    let res;
    if (editingDispatchId) {
      res = await whatsappService.updateQueueItem(editingDispatchId, {
        recipient_phone: whatsappForm.recipient_phone,
        recipient_name: whatsappForm.recipient_name,
        message_body: whatsappForm.message_body,
      });
    } else {
      res = await whatsappService.createQueueItem({
        recipient_phone: whatsappForm.recipient_phone,
        recipient_name: whatsappForm.recipient_name,
        event_type: whatsappForm.event_type,
        message_body: whatsappForm.message_body,
      });
    }

    setIsSubmittingDispatch(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice(
        editingDispatchId
          ? "WhatsApp dispatch updated successfully."
          : "New WhatsApp dispatch enqueued successfully."
      );
      setIsWhatsAppModalOpen(false);
      setEditingDispatchId(null);
      setWhatsappForm({
        recipient_phone: "",
        recipient_name: "",
        event_type: "manual_broadcast",
        message_body: "",
      });
      loadData();
    }
  };

  const canBroadcast = role === "super_admin" || role === "owner" || role === "admin";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="eyebrow">COMMUNICATION & NOTIFICATIONS</div>
          <h1 className="text-2xl font-extrabold text-[#102f50]">Announcements & WhatsApp</h1>
          <p className="text-sm text-slate-500">
            Publish institute broadcasts and monitor real-time WhatsApp attendance & fee dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "whatsapp_queue" && (
            <>
              {canBroadcast && (
                <>
                  <Button
                    variant="primary"
                    icon={<Plus size={15} />}
                    onClick={handleOpenCreateWhatsAppDispatch}
                  >
                    New Dispatch
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Send size={15} />}
                    isLoading={isDispatching}
                    onClick={handleDispatchQueue}
                  >
                    Dispatch Queue
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                icon={<RefreshCw size={15} />}
                onClick={loadData}
              >
                Refresh Queue
              </Button>
            </>
          )}

          {canBroadcast && activeTab === "broadcasts" && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              New Announcement
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("broadcasts")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "broadcasts"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Bell size={17} />
          Broadcast Feed ({announcements.length})
        </button>
        {canBroadcast && (
          <>
            <button
              onClick={() => setActiveTab("whatsapp_queue")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "whatsapp_queue"
                  ? "border-[#16466f] text-[#16466f]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <MessageSquare size={17} />
              WhatsApp Notification Dispatcher
            </button>
            <button
              onClick={() => setActiveTab("automations")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "automations"
                  ? "border-[#16466f] text-[#16466f]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles size={17} className="text-amber-500" />
              Automations Engine Suite
            </button>
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

      {loading ? (
        <LoadingSpinner label="Loading communications data..." size="lg" />
      ) : activeTab === "broadcasts" ? (
        /* Announcements list */
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
              <Bell size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-700">No announcements posted</h3>
              <p className="text-xs text-slate-500 mt-1">
                Broadcast holiday notices, exam dates, or timetable revisions here.
              </p>
            </div>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        a.priority === "urgent"
                          ? "red"
                          : a.priority === "high"
                          ? "amber"
                          : "blue"
                      }
                      size="sm"
                    >
                      {a.priority.toUpperCase()}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-500">
                      Target: {a.target_role.toUpperCase()}
                    </span>
                    {a.batch_name && (
                      <span className="text-xs font-bold text-slate-700">
                        • {a.batch_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                    {canBroadcast && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(a)}
                          className="p-1.5 text-slate-400 hover:text-[#16466f] hover:bg-slate-100 rounded-md transition"
                          title="Edit Announcement"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === a.id}
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition disabled:opacity-50"
                          title="Delete Announcement"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-lg leading-snug">{a.title}</h3>
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                  {a.message}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        /* WhatsApp Queue Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                WhatsApp Cloud API Asynchronous Queue
              </h3>
              <p className="text-xs text-slate-500">
                Messages enqueued automatically upon attendance submission and fee collection.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <ShieldCheck size={14} />
              <span>Deduplication & Retry Active</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Recipient Phone</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Template / Type</th>
                  <th className="py-3 px-4">Message Body Preview</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Enqueued At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queueItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                      No notifications currently in queue. Submit attendance or fees to view dispatches.
                    </td>
                  </tr>
                ) : (
                  queueItems.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-slate-400" />
                          {q.phone_number}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {q.student_name || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-semibold text-slate-700">
                          {q.message_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={q.message_body}>
                        {q.message_body}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            q.status === "sent"
                              ? "green"
                              : q.status === "pending"
                              ? "amber"
                              : q.status === "skipped_test_mode"
                              ? "neutral"
                              : "red"
                          }
                          size="sm"
                        >
                          {q.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono">{q.attempts} / {q.max_attempts}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(q.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(q.status === "failed" || q.status === "skipped_test_mode") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={isRetryingId === q.id}
                              icon={<RotateCw size={13} />}
                              onClick={() => handleRetryMessage(q.id)}
                              title="Retry dispatch"
                            >
                              Retry
                            </Button>
                          )}
                          {canBroadcast && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEditWhatsAppDispatch(q)}
                                className="p-1.5 text-slate-400 hover:text-[#16466f] hover:bg-slate-100 rounded-md transition"
                                title="Edit Dispatch"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWhatsAppDispatch(q.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                title="Delete Dispatch"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Automations Suite */}
      {activeTab === "automations" && (
        <div className="space-y-6">
          {/* Engine Banner */}
          <div className="bg-gradient-to-r from-[#102f50] via-[#16466f] to-[#1c598d] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold tracking-wide backdrop-blur-sm border border-white/10">
                <Sparkles size={13} />
                PRADEEP CLASSES AUTOMATED ENGAGEMENT ENGINE
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Automated WhatsApp Academic & Operational Triggers
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Autonomous background routines keep parents updated on student attendance, pending fee invoices,
                exam scorecards, daily class homework, and birthday greetings with zero manual dispatch overhead.
              </p>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial from-amber-400/10 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Last Automation Execution Log */}
          {automationLog && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-extrabold text-sm text-emerald-950">
                    {automationLog.automationName} Completed
                  </div>
                  <div className="text-emerald-800 leading-relaxed font-medium">
                    {automationLog.details}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-mono pt-1">
                    Processed: {automationLog.processedCount} records • Queued: {automationLog.queuedCount} dispatches • Last Run: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutomationLog(null)}
                className="text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100/60"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Automations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Batch Attendance 5-Min Auto-Dispatch */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    <Clock size={20} />
                  </div>
                  <Badge variant="blue" size="sm">5-Min Auto Trigger</Badge>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Batch Attendance 5-Min Delay</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Automatically triggered right after roll call is saved for any batch. Sends absent notices to parents 5 minutes later.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                  Dear Parent, [Name] was marked absent from [Batch] on [Date] at Pradeep Classes...
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active on Save
                </span>
                <span className="text-[10px] text-slate-400">Triggered via Attendance Page</span>
              </div>
            </div>

            {/* 2. Daily Absence Digest (6:30 PM) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                    <AlertTriangle size={20} />
                  </div>
                  <Badge variant="red" size="sm">Daily at 6:30 PM</Badge>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Daily Absence Digest</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Scans day-end attendance sessions and sends a single consolidated WhatsApp notice to parents of absent students.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                  Dear Parent, [Student Name] was marked absent from today's classes at Pradeep Classes. Please reply if this was informed.
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Scheduled: 6:30 PM</span>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={runningAutomation === "Daily Absence Digest"}
                  onClick={() =>
                    handleExecuteAutomation("Daily Absence Digest", () =>
                      whatsappAutomationService.runDailyAbsenceDigest()
                    )
                  }
                  icon={<Play size={13} />}
                >
                  Run Scan Now
                </Button>
              </div>
            </div>

            {/* 3. Monthly Fee Due Auto-Reminder (1st & 10th) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Receipt size={20} />
                  </div>
                  <Badge variant="amber" size="sm">1st & 10th Monthly</Badge>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Monthly Fee Due Reminders</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Scans students with overdue balances and generates personalized payment reminders with exact pending amount and payment link.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                  Dear Parent, an overdue balance of ₹[Due] is pending for [Student]... https://app.pradeepclasses.in/portal
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Overdue Balances</span>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={runningAutomation === "Monthly Fee Due Reminders"}
                  onClick={() =>
                    handleExecuteAutomation("Monthly Fee Due Reminders", () =>
                      whatsappAutomationService.scanAndQueueMonthlyFeeReminders()
                    )
                  }
                  icon={<Play size={13} />}
                >
                  Scan Dues Now
                </Button>
              </div>
            </div>

            {/* 4. Instant Fee Deposit Receipt */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <Receipt size={20} />
                  </div>
                  <Badge variant="green" size="sm">Instant Trigger</Badge>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Instant Fee Deposit Receipt</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Automatically triggered when any fee payment is recorded in the Fee Ledger. Dispatches payment receipt to parent.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                  Dear Parent, fee payment of ₹[Amount] for [Student] has been received successfully via [Mode]. Receipt No: [REC]...
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active on Payment
                </span>
                <span className="text-[10px] text-slate-400">Triggered via Fee Records</span>
              </div>
            </div>

            {/* 5. Daily Class Diary & Homework Broadcast (7:00 PM) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <BookOpen size={20} />
                  </div>
                  <Badge variant="violet" size="sm">Daily at 7:00 PM</Badge>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Class Diary & Homework Broadcast</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Sends daily summary of topics covered in class and homework assigned directly to batch parents for home monitoring.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                  Dear Parent, Daily Academic Digest for [Batch]: 📚 Topics Covered: ... 📝 Homework Assigned: ...
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Scheduled: 7:00 PM</span>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={runningAutomation === "Class Diary & Homework"}
                  onClick={() =>
                    handleExecuteAutomation("Class Diary & Homework", () =>
                      whatsappAutomationService.broadcastDailyDiaryAndHomework()
                    )
                  }
                  icon={<Play size={13} />}
                >
                  Broadcast Today
                </Button>
              </div>
            </div>

            {/* 6. Automated Student Birthday Wishes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center font-bold">
                    <Cake size={20} />
                  </div>
                  <Badge variant="violet" size="sm">Daily at 8:00 AM</Badge>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Student Birthday Greetings</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Automatically scans students celebrating birthdays today and dispatches a warm greeting from the Faculty Team.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                  🎉 Happy Birthday to our dear student [Name]! May you achieve great success... Pradeep Classes Faculty Team! 🎂
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Daily Morning Scan</span>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={runningAutomation === "Birthday Wishes"}
                  onClick={() =>
                    handleExecuteAutomation("Birthday Wishes", () =>
                      whatsappAutomationService.scanAndQueueBirthdayWishes()
                    )
                  }
                  icon={<Play size={13} />}
                >
                  Scan Birthdays
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingId(null);
          }}
          title={editingId ? "Edit Announcement" : "Create Broadcast Announcement"}
        >
          <form onSubmit={handleCreateOrUpdateAnnouncement} className="space-y-4">
            <Input
              label="Subject / Heading"
              required
              placeholder="e.g. Schedule Change for Physics Batch"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Target Audience"
                options={[
                  { value: "all", label: "Everyone (All Members)" },
                  { value: "staff", label: "Faculty / Staff Only" },
                  { value: "batch", label: "Specific Batch Only" },
                ]}
                value={form.target_role}
                onChange={(e) => setForm({ ...form, target_role: e.target.value })}
              />

              <Select
                label="Priority Level"
                options={[
                  { value: "normal", label: "Normal Notice" },
                  { value: "urgent", label: "Urgent Alert" },
                  { value: "announcement", label: "Official Announcement" },
                ]}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as "normal" | "urgent" | "announcement" })}
              />
            </div>

            {form.target_role === "batch" && (
              <Select
                label="Select Specific Batch"
                required
                options={batches.map((b) => ({ value: b.id, label: b.name }))}
                value={form.batch_id}
                onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
              />
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Notice Body</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16466f]"
                rows={4}
                required
                placeholder="Enter complete announcement message text..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
                icon={<Send size={16} />}
              >
                {editingId ? "Save Changes" : "Publish Broadcast"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* WhatsApp Dispatch Modal (Create / Edit) */}
      {isWhatsAppModalOpen && (
        <Modal
          isOpen={isWhatsAppModalOpen}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setEditingDispatchId(null);
          }}
          title={editingDispatchId ? "Edit WhatsApp Dispatch" : "Create New WhatsApp Dispatch"}
        >
          <form onSubmit={handleCreateOrUpdateWhatsAppDispatch} className="space-y-4">
            <Input
              label="Recipient Phone Number"
              placeholder="e.g. 9812345678 or 919812345678"
              value={whatsappForm.recipient_phone}
              onChange={(e) =>
                setWhatsappForm({ ...whatsappForm, recipient_phone: e.target.value })
              }
              required
              helperText="10-digit mobile number. Country code 91 is formatted automatically."
            />

            <Input
              label="Recipient / Student Name (Optional)"
              placeholder="e.g. Rahul Sharma"
              value={whatsappForm.recipient_name}
              onChange={(e) =>
                setWhatsappForm({ ...whatsappForm, recipient_name: e.target.value })
              }
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Event / Dispatch Category
              </label>
              <select
                value={whatsappForm.event_type}
                onChange={(e) =>
                  setWhatsappForm({ ...whatsappForm, event_type: e.target.value })
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
              >
                <option value="announcement">Official Announcement Broadcast</option>
                <option value="fee_receipt">Fee Payment / Dues Notice</option>
                <option value="attendance_absent">Attendance Absence Alert</option>
                <option value="test_message">Test / General Notice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Message Content <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16466f]"
                rows={4}
                required
                placeholder="Type the message to be dispatched via WhatsApp..."
                value={whatsappForm.message_body}
                onChange={(e) =>
                  setWhatsappForm({ ...whatsappForm, message_body: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsWhatsAppModalOpen(false);
                  setEditingDispatchId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingDispatch}
                icon={<Send size={15} />}
              >
                {editingDispatchId ? "Save Changes" : "Enqueue WhatsApp Message"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
