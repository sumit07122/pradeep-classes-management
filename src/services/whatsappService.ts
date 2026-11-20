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
};
