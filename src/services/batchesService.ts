import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { batches as demoBatchNames } from "../data/demo";
import type { Batch } from "../types";

export const batchesService = {
  async getBatches(): Promise<{ data: Batch[]; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      const demoBatches: Batch[] = demoBatchNames.map((name, i) => ({
        id: `demo-batch-${i + 1}`,
        name,
        course_name: name.includes("JEE") ? "JEE Advanced" : name.includes("NEET") ? "NEET Medical" : "Board Foundations",
        academic_year: "2026-2027",
        student_count: [42, 36, 28, 21][i] || 25,
        assigned_teachers: [["Amit Kumar"], ["Neha Sharma"], ["Rahul Mishra"], ["Amit Kumar"]][i],
        is_active: true,
        is_demo: true,
      }));
      return { data: demoBatches, isDemo: true };
    }

    try {
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, name, course_name, academic_year, is_active,
          students ( count ),
          teacher_batches (
            teachers ( full_name )
          )
        `)
        .order("name");

      if (error) {
        return { data: [], error: error.message, isDemo: false };
      }

      const mapped: Batch[] = (data || []).map((row: any) => {
        const studentCount = row.students?.[0]?.count || 0;
        const teachers = (row.teacher_batches || [])
          .map((tb: any) => tb.teachers?.full_name)
          .filter(Boolean);

        return {
          id: row.id,
          name: row.name,
          course_name: row.course_name,
          academic_year: row.academic_year || "2026-2027",
          student_count: studentCount,
          assigned_teachers: teachers,
          is_active: row.is_active ?? true,
          is_demo: false,
        };
      });

      return { data: mapped, isDemo: false };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch batches", isDemo: false };
    }
  },

  async createBatch(
    batch: Omit<Batch, "id" | "is_demo">
  ): Promise<{ data: Batch | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      const newBatch: Batch = {
        id: crypto.randomUUID(),
        ...batch,
        is_demo: true,
      };
      return { data: newBatch };
    }

    const { data, error } = await supabase
      .from("batches")
      .insert({
        name: batch.name,
        course_name: batch.course_name,
        academic_year: batch.academic_year || "2026-2027",
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
        name: data.name,
        course_name: data.course_name,
        academic_year: data.academic_year,
        student_count: 0,
        is_active: true,
        is_demo: false,
      },
    };
  },
};
