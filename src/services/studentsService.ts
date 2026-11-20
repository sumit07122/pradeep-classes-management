import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { demoStudents, batches } from "../data/demo";
import type { Student } from "../types";

export const studentsService = {
  async getStudents(): Promise<{ data: Student[]; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: demoStudents.map((s) => ({ ...s, is_demo: true })),
        isDemo: true,
      };
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase students error:", error.message);
        return { data: [], error: error.message, isDemo: false };
      }

      const mapped: Student[] = (data || []).map((row) => ({
        id: row.id,
        admission_no: row.admission_no,
        full_name: row.full_name,
        class_name: row.class_name,
        batch_name: row.batch_name || "Unassigned",
        batch_id: row.batch_id,
        profile_id: row.profile_id,
        phone: row.phone || "",
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        status:
          row.status === "active"
            ? "Active"
            : row.status === "on_hold"
            ? "On hold"
            : "Inactive",
        joined_on: row.joined_on,
        created_at: row.created_at,
        is_demo: false,
      }));

      return { data: mapped, isDemo: false };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch students", isDemo: false };
    }
  },

  async createStudent(
    student: Omit<Student, "id" | "admission_no" | "status" | "is_demo">
  ): Promise<{ data: Student | null; error?: string }> {
    const admissionYear = new Date().getFullYear();
    const admissionNo = `PC-${admissionYear}-${Math.floor(100 + Math.random() * 900)}`;

    if (!isSupabaseConfigured || !supabase) {
      const newStudent: Student = {
        id: crypto.randomUUID(),
        admission_no: admissionNo,
        ...student,
        status: "Active",
        is_demo: true,
        created_at: new Date().toISOString(),
      };
      return { data: newStudent };
    }

    const { data, error } = await supabase
      .from("students")
      .insert({
        admission_no: admissionNo,
        full_name: student.full_name,
        class_name: student.class_name,
        batch_name: student.batch_name,
        batch_id: student.batch_id,
        profile_id: student.profile_id,
        phone: student.phone,
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        id: data.id,
        admission_no: data.admission_no,
        full_name: data.full_name,
        class_name: data.class_name,
        batch_name: data.batch_name,
        phone: data.phone || "",
        status: "Active",
        is_demo: false,
        created_at: data.created_at,
      },
    };
  },

  getAvailableBatches(): string[] {
    return batches;
  },
};
