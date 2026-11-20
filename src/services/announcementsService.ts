import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Announcement } from "../types";

export const announcementsService = {
  async getAnnouncements(batchId?: string): Promise<{ data: Announcement[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("announcements")
        .select(`
          id, institute_id, title, content, message, target_type, target_role,
          priority, target_batch_id, batch_id, created_by, created_at,
          batches:target_batch_id ( name )
        `)
        .order("created_at", { ascending: false });

      if (batchId) {
        query = query.or(`target_type.eq.all,target_batch_id.eq.${batchId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items: Announcement[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        title: row.title,
        message: row.message || row.content || "",
        target_role: row.target_role || row.target_type || "all",
        batch_id: row.batch_id || row.target_batch_id || null,
        batch_name: row.batches?.name || (row.target_type === "all" ? "All Students" : "General"),
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

      const content = ann.message.trim();
      const targetType = ann.target_role || "all";
      const targetBatchId = ann.batch_id || null;

      const { data, error } = await supabase
        .from("announcements")
        .insert({
          institute_id: instId,
          title: ann.title.trim(),
          content: content,
          target_type: targetType,
          target_batch_id: targetBatchId,
          priority: ann.priority || "normal",
          created_by: profile.user?.id,
        })
        .select("*, batches:target_batch_id(name)")
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          title: data.title,
          message: data.content || data.message,
          target_role: data.target_type || data.target_role,
          batch_id: data.target_batch_id || data.batch_id,
          batch_name: data.batches?.name || (data.target_type === "all" ? "All Students" : "General"),
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

  async updateAnnouncement(
    id: string,
    ann: Partial<Omit<Announcement, "id" | "created_at" | "institute_id">>
  ): Promise<{ data: Announcement | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: null, error: "Database not configured" };

    try {
      const payload: Record<string, any> = {};
      if (ann.title !== undefined) payload.title = ann.title.trim();
      if (ann.message !== undefined) {
        payload.message = ann.message.trim();
        payload.content = ann.message.trim();
      }
      if (ann.target_role !== undefined) {
        payload.target_role = ann.target_role;
        payload.target_type = ann.target_role;
      }
      if (ann.priority !== undefined) payload.priority = ann.priority;
      if (ann.batch_id !== undefined) {
        payload.batch_id = ann.batch_id || null;
        payload.target_batch_id = ann.batch_id || null;
      }

      const { data, error } = await supabase
        .from("announcements")
        .update(payload)
        .eq("id", id)
        .select("*, batches:target_batch_id(name)")
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          title: data.title,
          message: data.content || data.message,
          target_role: data.target_type || data.target_role,
          batch_id: data.target_batch_id || data.batch_id,
          batch_name: data.batches?.name || (data.target_type === "all" ? "All Students" : "General"),
          priority: data.priority,
          created_by: data.created_by,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to update announcement" };
    }
  },
};
