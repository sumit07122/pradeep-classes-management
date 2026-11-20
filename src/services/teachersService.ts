import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { demoTeachers } from "../data/demo";
import type { Teacher } from "../types";

export const teachersService = {
  async getTeachers(): Promise<{ data: Teacher[]; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: demoTeachers.map((t) => ({ ...t, is_demo: true })),
        isDemo: true,
      };
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .select(`
          id, profile_id, full_name, subject, phone, is_active,
          teacher_batches (
            batches ( name )
          )
        `)
        .order("full_name");

      if (error) {
        return { data: [], error: error.message, isDemo: false };
      }

      const mapped: Teacher[] = (data || []).map((row: any) => {
        const assigned = (row.teacher_batches || [])
          .map((tb: any) => tb.batches?.name)
          .filter(Boolean);

        return {
          id: row.id,
          profile_id: row.profile_id,
          full_name: row.full_name,
          subject: row.subject,
          phone: row.phone || "",
          assigned_batches: assigned.length > 0 ? assigned : ["General Subject Batch"],
          is_active: row.is_active ?? true,
          is_demo: false,
        };
      });

      return { data: mapped, isDemo: false };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch teachers", isDemo: false };
    }
  },

  async createTeacher(
    teacher: Omit<Teacher, "id" | "is_demo">
  ): Promise<{ data: Teacher | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      const newTeacher: Teacher = {
        id: crypto.randomUUID(),
        ...teacher,
        is_demo: true,
      };
      return { data: newTeacher };
    }

    const { data, error } = await supabase
      .from("teachers")
      .insert({
        full_name: teacher.full_name,
        subject: teacher.subject,
        phone: teacher.phone,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        id: data.id,
        full_name: data.full_name,
        subject: data.subject,
        phone: data.phone || "",
        assigned_batches: teacher.assigned_batches,
        is_active: true,
        is_demo: false,
      },
    };
  },
};
