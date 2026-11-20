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
          is_enabled: true,
          phone_number_id: "demo-phone-id",
          waba_id: "demo-waba-id",
          access_token: "demo-token",
          test_mode: true,
          verified_number: "+91 98765 43210",
          send_present_alert: true,
          send_absent_alert: true,
          send_late_alert: true,
          send_leave_alert: true,
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
      return { data: data as WhatsAppSettings | null };
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
      // Upsert into whatsapp_settings for default institute
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .upsert(
          {
            institute_id: DEFAULT_INSTITUTE_ID,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "institute_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return { data: data as WhatsAppSettings };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },
};
