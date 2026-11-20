import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { InstituteSettings, WhatsAppSettings } from "../types/settings";

const DEFAULT_INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

export const settingsService = {
  /**
   * Fetch institute profile & configuration
   */
  async getInstituteSettings(): Promise<{ data: InstituteSettings | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: {
          id: "demo-settings",
          institute_id: DEFAULT_INSTITUTE_ID,
          institute_name: "Pradeep Classes",
          tagline: "Excellence in Coaching & Academic Mastery",
          phone: "+91 98765 43210",
          email: "contact@pradeepclasses.in",
          address: "Sector 4, Main Commercial Complex, Coaching Hub",
          city: "Kota",
          state: "Rajasthan",
          pincode: "324005",
          website: "https://pradeepclasses.in",
          logo_url: null,
          academic_year: "2026-2027",
          default_pass_percentage: 40.0,
          fee_late_fine_daily: 50.0,
          currency_symbol: "₹",
          timezone: "Asia/Kolkata",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    try {
      const { data, error } = await supabase
        .from("institute_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return { data: data as InstituteSettings | null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Update institute profile settings
   */
  async updateInstituteSettings(
    updates: Partial<Omit<InstituteSettings, "id" | "institute_id" | "created_at" | "updated_at">>
  ): Promise<{ data: InstituteSettings | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: {
          id: "demo-settings",
          institute_id: DEFAULT_INSTITUTE_ID,
          institute_name: updates.institute_name || "Pradeep Classes",
          tagline: updates.tagline || "",
          phone: updates.phone || "",
          email: updates.email || "",
          address: updates.address || "",
          city: updates.city || "",
          state: updates.state || "",
          pincode: updates.pincode || "",
          website: updates.website || "",
          logo_url: updates.logo_url || null,
          academic_year: updates.academic_year || "2026-2027",
          default_pass_percentage: updates.default_pass_percentage || 40.0,
          fee_late_fine_daily: updates.fee_late_fine_daily || 50.0,
          currency_symbol: updates.currency_symbol || "₹",
          timezone: updates.timezone || "Asia/Kolkata",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    try {
      const { data, error } = await supabase
        .from("institute_settings")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("institute_id", DEFAULT_INSTITUTE_ID)
        .select()
        .single();

      if (error) throw error;
      return { data: data as InstituteSettings };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Fetch WhatsApp integration credentials and delivery configuration
   */
  async getWhatsAppSettings(): Promise<{ data: WhatsAppSettings | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: {
          id: "demo-whatsapp-settings",
          institute_id: DEFAULT_INSTITUTE_ID,
          is_enabled: false,
          phone_number_id: "",
          waba_id: "",
          business_account_id: "",
          access_token: "",
          api_token: "",
          test_mode: true,
          verified_number: "+91 98765 43210",
          sender_phone_number: "+91 98765 43210",
          send_present_alert: true,
          notify_on_present: true,
          send_absent_alert: true,
          notify_on_absent: true,
          send_late_alert: true,
          notify_on_late: true,
          send_leave_alert: true,
          notify_on_leave: true,
          send_fee_receipt_alert: true,
          send_exam_result_alert: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    try {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) return { data: null };

      const formatted: WhatsAppSettings = {
        id: data.id,
        institute_id: data.institute_id,
        is_enabled: Boolean(data.is_enabled),
        phone_number_id: data.phone_number_id,
        waba_id: data.business_account_id,
        business_account_id: data.business_account_id,
        access_token: data.api_token,
        api_token: data.api_token,
        test_mode: !data.is_enabled || !data.api_token,
        verified_number: data.sender_phone_number,
        sender_phone_number: data.sender_phone_number,
        send_present_alert: data.notify_on_present ?? true,
        notify_on_present: data.notify_on_present ?? true,
        send_absent_alert: data.notify_on_absent ?? true,
        notify_on_absent: data.notify_on_absent ?? true,
        send_late_alert: data.notify_on_late ?? true,
        notify_on_late: data.notify_on_late ?? true,
        send_leave_alert: data.notify_on_leave ?? true,
        notify_on_leave: data.notify_on_leave ?? true,
        send_fee_receipt_alert: true,
        send_exam_result_alert: true,
        template_present: data.template_present,
        template_absent: data.template_absent,
        template_late: data.template_late,
        template_leave: data.template_leave,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      return { data: formatted };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Update WhatsApp integration configuration
   */
  async updateWhatsAppSettings(
    updates: Partial<Omit<WhatsAppSettings, "id" | "institute_id" | "created_at" | "updated_at">>
  ): Promise<{ data: WhatsAppSettings | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: {
          id: "demo-whatsapp-settings",
          institute_id: DEFAULT_INSTITUTE_ID,
          is_enabled: updates.is_enabled ?? true,
          phone_number_id: updates.phone_number_id || "",
          waba_id: updates.waba_id || "",
          access_token: updates.access_token || "",
          test_mode: updates.test_mode ?? true,
          verified_number: updates.verified_number || "",
          send_present_alert: updates.send_present_alert ?? true,
          send_absent_alert: updates.send_absent_alert ?? true,
          send_late_alert: updates.send_late_alert ?? true,
          send_leave_alert: updates.send_leave_alert ?? true,
          send_fee_receipt_alert: updates.send_fee_receipt_alert ?? true,
          send_exam_result_alert: updates.send_exam_result_alert ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    try {
      const dbPayload = {
        institute_id: DEFAULT_INSTITUTE_ID,
        is_enabled: updates.is_enabled ?? false,
        phone_number_id: (updates.phone_number_id || "").trim() || null,
        business_account_id: (updates.business_account_id || updates.waba_id || "").trim() || null,
        api_token: (updates.api_token || updates.access_token || "").trim() || null,
        sender_phone_number: (updates.sender_phone_number || updates.verified_number || "").trim() || null,
        notify_on_present: updates.notify_on_present ?? updates.send_present_alert ?? true,
        notify_on_absent: updates.notify_on_absent ?? updates.send_absent_alert ?? true,
        notify_on_late: updates.notify_on_late ?? updates.send_late_alert ?? true,
        notify_on_leave: updates.notify_on_leave ?? updates.send_leave_alert ?? true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("whatsapp_settings")
        .upsert(dbPayload, { onConflict: "institute_id" })
        .select()
        .single();

      if (error) throw error;

      const formatted: WhatsAppSettings = {
        id: data.id,
        institute_id: data.institute_id,
        is_enabled: Boolean(data.is_enabled),
        phone_number_id: data.phone_number_id,
        waba_id: data.business_account_id,
        business_account_id: data.business_account_id,
        access_token: data.api_token,
        api_token: data.api_token,
        test_mode: !data.is_enabled || !data.api_token,
        verified_number: data.sender_phone_number,
        sender_phone_number: data.sender_phone_number,
        send_present_alert: data.notify_on_present,
        notify_on_present: data.notify_on_present,
        send_absent_alert: data.notify_on_absent,
        notify_on_absent: data.notify_on_absent,
        send_late_alert: data.notify_on_late,
        notify_on_late: data.notify_on_late,
        send_leave_alert: data.notify_on_leave,
        notify_on_leave: data.notify_on_leave,
        send_fee_receipt_alert: true,
        send_exam_result_alert: true,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      return { data: formatted };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },
};
