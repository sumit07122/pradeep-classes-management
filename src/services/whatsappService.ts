import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { WhatsAppSettings, WhatsAppMessageQueueItem } from "../types";

export const whatsappService = {
  async getSettings(): Promise<{ data: WhatsAppSettings | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: null };

    try {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return { data };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to load WhatsApp settings" };
    }
  },

  async updateSettings(
    settings: Partial<WhatsAppSettings>
  ): Promise<{ data: WhatsAppSettings | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: null, error: "Database not configured" };

    try {
      const { data: profile } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("institute_id")
        .eq("id", profile.user?.id)
        .single();

      const instId = userProfile?.institute_id || "11111111-2222-3333-4444-555555555555";

      const { data, error } = await supabase
        .from("whatsapp_settings")
        .upsert(
          {
            institute_id: instId,
            phone_number_id: settings.phone_number_id?.trim() || null,
            waba_id: settings.waba_id?.trim() || null,
            access_token: settings.access_token?.trim() || null,
            verified_number: settings.verified_number?.trim() || null,
            test_mode: settings.test_mode ?? true,
            is_enabled: settings.is_enabled ?? true,
            send_present_alert: settings.send_present_alert ?? true,
            send_absent_alert: settings.send_absent_alert ?? true,
            send_late_alert: settings.send_late_alert ?? true,
            send_leave_alert: settings.send_leave_alert ?? true,
            send_fee_receipt_alert: settings.send_fee_receipt_alert ?? true,
            send_exam_result_alert: settings.send_exam_result_alert ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "institute_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return { data };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to update WhatsApp settings" };
    }
  },

  async getMessageQueue(limit = 50): Promise<{ data: WhatsAppMessageQueueItem[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .select(`
          id, institute_id, student_id, phone_number,
          message_type, message_body, status, attempts,
          max_attempts, error_message, created_at, sent_at,
          students ( full_name )
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const items: WhatsAppMessageQueueItem[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        student_id: row.student_id,
        student_name: row.students?.full_name || "Student",
        phone_number: row.phone_number,
        message_type: row.message_type,
        message_body: row.message_body,
        status: row.status,
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
