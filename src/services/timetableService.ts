import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { TimetableEntry } from "../types";

export const timetableService = {
  async getTimetables(batchId?: string): Promise<{ data: TimetableEntry[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("timetables")
        .select(`
          id, institute_id, batch_id, teacher_id, subject,
          day_of_week, start_time, end_time, room_number, is_active, created_at,
          batches ( name ),
          teachers ( full_name )
        `)
        .eq("is_active", true)
        .order("start_time");

      if (batchId) {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const entries: TimetableEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        batch_id: row.batch_id,
        batch_name: row.batches?.name || "Assigned Batch",
        teacher_id: row.teacher_id,
        teacher_name: row.teachers?.full_name || "Assigned Faculty",
        subject: row.subject,
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        room_number: row.room_number || "Classroom",
        is_active: row.is_active,
        created_at: row.created_at,
      }));

      return { data: entries };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load timetables" };
    }
  },

  async createTimetableEntry(
    entry: Omit<TimetableEntry, "id" | "created_at" | "institute_id">
  ): Promise<{ data: TimetableEntry | null; error?: string }> {
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
        .from("timetables")
        .insert({
          institute_id: instId,
          batch_id: entry.batch_id,
          teacher_id: entry.teacher_id || null,
          subject: entry.subject,
          day_of_week: entry.day_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
          room_number: entry.room_number?.trim() || null,
          is_active: true,
        })
        .select("*, batches(name), teachers(full_name)")
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          batch_id: data.batch_id,
          batch_name: data.batches?.name || "Assigned Batch",
          teacher_id: data.teacher_id,
          teacher_name: data.teachers?.full_name || "Faculty",
          subject: data.subject,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
          room_number: data.room_number || "Classroom",
          is_active: data.is_active,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to schedule class session" };
    }
  },

  async deleteTimetableEntry(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false };

    try {
      const { error } = await supabase.from("timetables").delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to remove timetable entry" };
    }
  },

  async getTimetable(batchId?: string): Promise<{ data: TimetableEntry[]; error?: string }> {
    return this.getTimetables(batchId);
  },

  async createEntry(
    entry: Omit<TimetableEntry, "id" | "created_at" | "institute_id">
  ): Promise<{ data: TimetableEntry | null; error?: string }> {
    return this.createTimetableEntry(entry);
  },

  async deleteEntry(id: string): Promise<{ success: boolean; error?: string }> {
    return this.deleteTimetableEntry(id);
  },
};
