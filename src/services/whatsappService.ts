import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { WhatsAppSettings, WhatsAppMessageQueueItem } from "../types";
import { settingsService } from "./settingsService";

export const whatsappService = {
  /**
   * Fetch WhatsApp integration credentials & settings
   */
  async getSettings(): Promise<{ data: WhatsAppSettings | null; error?: string }> {
    return settingsService.getWhatsAppSettings();
  },

  /**
   * Update WhatsApp settings
   */
  async updateSettings(
    settings: Partial<WhatsAppSettings>
  ): Promise<{ data: WhatsAppSettings | null; error?: string }> {
    return settingsService.updateWhatsAppSettings(settings);
  },

  /**
   * Fetch recent queued, sent, and pending notifications
   */
  async getMessageQueue(limit = 50): Promise<{ data: WhatsAppMessageQueueItem[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .select(`
          id, institute_id, student_id, recipient_phone, recipient_name,
          event_type, template_name, message_body, status, attempts,
          max_attempts, provider_response_id, error_message, created_at, sent_at
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const items: WhatsAppMessageQueueItem[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        student_id: row.student_id,
        student_name: row.recipient_name || "Student",
        phone_number: row.recipient_phone,
        message_type: row.event_type,
        message_body: row.message_body,
        status: row.status as any,
        attempts: row.attempts,
        max_attempts: row.max_attempts,
        error_message: row.error_message,
        created_at: row.created_at,
        processed_at: row.sent_at,
      }));

      return { data: items };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load notification queue" };
    }
  },

  /**
   * Manually trigger immediate dispatch of pending messages in the queue
   */
  async dispatchQueue(): Promise<{ processed: number; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { processed: 0, error: "Database not configured" };
    }

    try {
      const { data, error } = await supabase.functions.invoke("dispatch-whatsapp", {
        method: "POST",
      });

      if (error) throw error;
      return { processed: data?.processed ?? 0 };
    } catch (err: any) {
      return { processed: 0, error: err.message || "Dispatch trigger failed" };
    }
  },

  /**
   * Reset failed notification for retry
   */
  async retryMessage(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false };

    try {
      const { error } = await supabase
        .from("whatsapp_message_queue")
        .update({
          status: "pending",
          attempts: 0,
          error_message: null,
        })
        .eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Retry failed" };
    }
  },

  /**
   * Create a new manual WhatsApp dispatch
   */
  async createQueueItem(params: {
    recipient_phone: string;
    recipient_name?: string;
    message_body: string;
    event_type?: string;
    student_id?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const cleanPhone = params.recipient_phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        return { success: false, error: "Recipient phone number must have at least 10 digits." };
      }
      if (!params.message_body || !params.message_body.trim()) {
        return { success: false, error: "Message body cannot be empty." };
      }

      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .insert({
          institute_id: "11111111-2222-3333-4444-555555555555",
          student_id: params.student_id || null,
          recipient_phone: cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone,
          recipient_name: params.recipient_name?.trim() || "Recipient",
          event_type: params.event_type || "announcement",
          template_name: "custom_message",
          message_body: params.message_body.trim(),
          status: "pending",
          attempts: 0,
          max_attempts: 3,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to create WhatsApp dispatch." };
    }
  },

  /**
   * Update an existing WhatsApp dispatch in queue
   */
  async updateQueueItem(
    id: string,
    params: {
      recipient_phone?: string;
      recipient_name?: string;
      message_body?: string;
      status?: "pending" | "sent" | "failed" | "skipped_test_mode";
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const updateData: any = {};
      if (params.recipient_phone) {
        const cleanPhone = params.recipient_phone.replace(/\D/g, "");
        updateData.recipient_phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      }
      if (params.recipient_name !== undefined) {
        updateData.recipient_name = params.recipient_name.trim();
      }
      if (params.message_body !== undefined) {
        if (!params.message_body.trim()) {
          return { success: false, error: "Message body cannot be empty." };
        }
        updateData.message_body = params.message_body.trim();
      }
      if (params.status) {
        updateData.status = params.status;
      }

      const { error } = await supabase
        .from("whatsapp_message_queue")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update WhatsApp dispatch." };
    }
  },

  /**
   * Permanently remove a dispatch from the WhatsApp queue
   */
  async deleteQueueItem(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const { error } = await supabase
        .from("whatsapp_message_queue")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete dispatch." };
    }
  },

  /**
   * Check if a duplicate notification was already queued/sent today
   */
  async checkDuplicateNotification(
    studentId: string,
    eventType: string,
    referenceId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const today = new Date().toISOString().split("T")[0];
      let query = supabase
        .from("whatsapp_message_queue")
        .select("id")
        .eq("student_id", studentId)
        .eq("event_type", eventType)
        .gte("created_at", `${today}T00:00:00Z`);

      if (referenceId) {
        query = query.eq("reference_id", referenceId);
      }

      const { data } = await query.limit(1);
      return Boolean(data && data.length > 0);
    } catch {
      return false;
    }
  },

  /**
   * Queue bulk absent notifications
   */
  async sendBulkAbsentAlerts(
    items: {
      student_id: string;
      student_name: string;
      batch_name: string;
      date: string;
      recipient_phone?: string;
      recipient_name?: string;
      recipient_type?: string;
      reference_id?: string;
      message_body: string;
      initiated_by?: string;
    }[]
  ): Promise<{ queuedCount: number; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { queuedCount: 0, error: "Database not configured" };

    try {
      const { data: settings } = await this.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = isLive ? "pending" : "skipped_test_mode";

      const rows = items.map((item) => ({
        institute_id: "11111111-2222-3333-4444-555555555555",
        student_id: item.student_id,
        recipient_phone: item.recipient_phone?.trim() || "0000000000",
        recipient_name: item.recipient_name?.trim() || item.student_name,
        event_type: "attendance_absent",
        template_name: "attendance_absent",
        message_body: item.message_body,
        parameters: {
          student_name: item.student_name,
          batch_name: item.batch_name,
          date: item.date,
          recipient_type: item.recipient_type || "parent",
          initiated_by: item.initiated_by,
        },
        status: queueStatus,
        attempts: 0,
        max_attempts: 3,
        error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        reference_id: item.reference_id || null,
      }));

      const { data, error } = await supabase.from("whatsapp_message_queue").insert(rows).select("id");
      if (error) throw error;

      return { queuedCount: data?.length || 0 };
    } catch (err: any) {
      return { queuedCount: 0, error: err.message || "Failed to queue absent alerts" };
    }
  },

  /**
   * Queue bulk fee reminders
   */
  async sendBulkFeeReminders(
    items: {
      student_id: string;
      student_name: string;
      amount_due: number;
      fee_title: string;
      recipient_phone?: string;
      recipient_name?: string;
      recipient_type?: string;
      reference_id?: string;
      message_body: string;
      initiated_by?: string;
    }[]
  ): Promise<{ queuedCount: number; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { queuedCount: 0, error: "Database not configured" };

    try {
      const { data: settings } = await this.getSettings();
      const isLive = Boolean(settings?.is_enabled && settings?.phone_number_id && settings?.api_token);
      const queueStatus = isLive ? "pending" : "skipped_test_mode";

      // Filter out any target whose amount_due is <= 0
      const eligible = items.filter((i) => i.amount_due > 0);
      if (eligible.length === 0) {
        return { queuedCount: 0, error: "No eligible invoices with positive balance due found." };
      }

      const rows = eligible.map((item) => ({
        institute_id: "11111111-2222-3333-4444-555555555555",
        student_id: item.student_id,
        recipient_phone: item.recipient_phone?.trim() || "0000000000",
        recipient_name: item.recipient_name?.trim() || item.student_name,
        event_type: "fee_due_reminder",
        template_name: "fee_due_reminder",
        message_body: item.message_body,
        parameters: {
          student_name: item.student_name,
          amount_due: item.amount_due,
          fee_title: item.fee_title,
          recipient_type: item.recipient_type || "parent",
          initiated_by: item.initiated_by,
        },
        status: queueStatus,
        attempts: 0,
        max_attempts: 3,
        error_message: isLive ? null : "Simulated in test mode (WhatsApp credentials not set).",
        reference_id: item.reference_id || null,
      }));

      const { data, error } = await supabase.from("whatsapp_message_queue").insert(rows).select("id");
      if (error) throw error;

      return { queuedCount: data?.length || 0 };
    } catch (err: any) {
      return { queuedCount: 0, error: err.message || "Failed to queue fee reminders" };
    }
  },
};
