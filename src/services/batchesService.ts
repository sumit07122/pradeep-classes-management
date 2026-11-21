import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Batch, Student } from "../types";

export const batchesService = {
  async getBatches(): Promise<{ data: Batch[]; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [], error: "Database service is not configured.", isDemo: false };
    }

    try {
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, name, course_name, academic_year, max_capacity,
          timing, room_number, start_date, end_date, status, is_active, institute_id,
          students ( count ),
          teacher_batches (
            teachers ( id, full_name, subject )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        return { data: [], error: error.message, isDemo: false };
      }

      const mapped: Batch[] = (data || []).map((row: any) => {
        const studentCount = row.students?.[0]?.count || 0;
        const maxCap = row.max_capacity || 40;
        const teachersList = (row.teacher_batches || [])
          .map((tb: any) => tb.teachers)
          .filter(Boolean);

        const teacherNames = teachersList.map((t: any) => t.full_name);

        return {
          id: row.id,
          name: row.name,
          course_name: row.course_name,
          academic_year: row.academic_year || "2026-2027",
          max_capacity: maxCap,
          timing: row.timing || "Not specified",
          room_number: row.room_number || "Unassigned",
          start_date: row.start_date,
          end_date: row.end_date,
          status: row.status || (row.is_active ? "active" : "archived"),
          student_count: studentCount,
          capacity_percentage: Math.min(100, Math.round((studentCount / maxCap) * 100)),
          assigned_teachers: teacherNames,
          teacher_assignments: teachersList,
          is_active: row.is_active ?? true,
          institute_id: row.institute_id,
          is_demo: false,
        };
      });

      return { data: mapped, isDemo: false };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch batches", isDemo: false };
    }
  },

  async createBatch(
    batch: Omit<Batch, "id" | "is_demo" | "student_count" | "capacity_percentage" | "assigned_teachers" | "teacher_assignments">
  ): Promise<{ data: Batch | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await supabase
        .from("batches")
        .insert({
          name: batch.name.trim(),
          course_name: batch.course_name.trim(),
          academic_year: batch.academic_year || "2026-2027",
          max_capacity: batch.max_capacity || 40,
          timing: batch.timing || null,
          room_number: batch.room_number || null,
          start_date: batch.start_date || null,
          end_date: batch.end_date || null,
          status: "active",
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
          max_capacity: data.max_capacity,
          timing: data.timing,
          room_number: data.room_number,
          status: "active",
          student_count: 0,
          capacity_percentage: 0,
          assigned_teachers: [],
          teacher_assignments: [],
          is_active: true,
          is_demo: false,
        },
      };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to create batch" };
    }
  },

  async updateBatch(
    id: string,
    updates: Partial<Batch>
  ): Promise<{ data: Batch | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.course_name !== undefined) payload.course_name = updates.course_name.trim();
      if (updates.academic_year !== undefined) payload.academic_year = updates.academic_year;
      if (updates.max_capacity !== undefined) payload.max_capacity = updates.max_capacity;
      if (updates.timing !== undefined) payload.timing = updates.timing;
      if (updates.room_number !== undefined) payload.room_number = updates.room_number;
      if (updates.start_date !== undefined) payload.start_date = updates.start_date;
      if (updates.end_date !== undefined) payload.end_date = updates.end_date;
      if (updates.status !== undefined) {
        payload.status = updates.status;
        payload.is_active = updates.status === "active";
      }

      const { data, error } = await supabase
        .from("batches")
        .update(payload)
        .eq("id", id)
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
          max_capacity: data.max_capacity,
          timing: data.timing,
          room_number: data.room_number,
          status: data.status,
          student_count: 0,
          capacity_percentage: 0,
          assigned_teachers: [],
          teacher_assignments: [],
          is_active: data.is_active,
          is_demo: false,
        },
      };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to update batch" };
    }
  },

  async archiveBatch(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { error } = await supabase
        .from("batches")
        .update({ status: "archived", is_active: false })
        .eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to archive batch" };
    }
  },

  async getBatchRoster(batchId: string): Promise<{ data: Student[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [] };
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("batch_id", batchId)
        .order("full_name");

      if (error) {
        return { data: [], error: error.message };
      }

      const mapped: Student[] = (data || []).map((row) => ({
        id: row.id,
        admission_no: row.admission_no,
        full_name: row.full_name,
        class_name: row.class_name,
        batch_name: row.batch_name || "Unassigned",
        batch_id: row.batch_id,
        phone: row.phone || "",
        email: row.email,
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        status:
          row.status === "active"
            ? "Active"
            : row.status === "on_hold"
            ? "On hold"
            : "Inactive",
        is_demo: false,
        created_at: row.created_at,
      }));

      return { data: mapped };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch batch roster" };
    }
  },

  async assignTeacher(batchId: string, teacherId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }
    try {
      const { error } = await supabase
        .from("teacher_batches")
        .insert({ batch_id: batchId, teacher_id: teacherId });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async removeTeacher(batchId: string, teacherId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }
    try {
      const { error } = await supabase
        .from("teacher_batches")
        .delete()
        .eq("batch_id", batchId)
        .eq("teacher_id", teacherId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async assignTeachersToBatch(
    batchId: string,
    teacherIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { error: delError } = await supabase
        .from("teacher_batches")
        .delete()
        .eq("batch_id", batchId);

      if (delError) {
        return { success: false, error: delError.message };
      }

      if (teacherIds.length > 0) {
        const payload = teacherIds.map((tId) => ({
          batch_id: batchId,
          teacher_id: tId,
        }));

        const { error: insError } = await supabase
          .from("teacher_batches")
          .insert(payload);

        if (insError) {
          return { success: false, error: insError.message };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to assign teachers" };
    }
  },
};
