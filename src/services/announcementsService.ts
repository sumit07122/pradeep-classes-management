import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Announcement } from "../types";

export const announcementsService = {
  async getAnnouncements(batchId?: string): Promise<{ data: Announcement[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("announcements")
        .select(`
          id, institute_id, title, message, target_role,
          priority, batch_id, created_by, created_at,
          batches ( name )
        `)
        .order("created_at", { ascending: false });

      if (batchId) {
        query = query.or(`target_role.eq.all,batch_id.eq.${batchId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items: Announcement[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        title: row.title,
        message: row.message,
        target_role: row.target_role,
        batch_id: row.batch_id,
        batch_name: row.batches?.name || (row.target_role === "all" ? "All Students" : "General"),
        priority: row.priority,
        created_by: row.created_by,
        created_at: row.created_at,
      }));

      return { data: items };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load announcements" };
    }
  },

  async createAnnouncement(
    ann: Omit<Announcement, "id" | "created_at" | "institute_id">
  ): Promise<{ data: Announcement | null; error?: string }> {
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
        .from("announcements")
        .insert({
          institute_id: instId,
          title: ann.title.trim(),
          message: ann.message.trim(),
          target_role: ann.target_role || "all",
          priority: ann.priority || "normal",
          batch_id: ann.batch_id || null,
          created_by: profile.user?.id,
        })
        .select("*, batches(name)")
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          title: data.title,
          message: data.message,
          target_role: data.target_role,
          batch_id: data.batch_id,
          batch_name: data.batches?.name || (data.target_role === "all" ? "All Students" : "General"),
          priority: data.priority,
          created_by: data.created_by,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to publish announcement" };
    }
  },

  async deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false };

    try {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to remove announcement" };
    }
  },
};
