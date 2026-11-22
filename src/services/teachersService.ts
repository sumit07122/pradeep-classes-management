import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Teacher, TeacherSalaryConfigData } from "../types";

const INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

export const teachersService = {
  async getTeachers(): Promise<{ data: Teacher[]; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: [],
        error: "Database service is not configured.",
        isDemo: false,
      };
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .select(`
          id, profile_id, full_name, subject, phone, is_active,
          teacher_batches (
            batch_id,
            batches ( id, name )
          ),
          teacher_salary_configs (
            calculation_type,
            base_amount,
            per_lecture_rate
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

        const salaryRow = Array.isArray(row.teacher_salary_configs)
          ? row.teacher_salary_configs[0]
          : row.teacher_salary_configs;

        const salary_config: TeacherSalaryConfigData | undefined = salaryRow
          ? {
            calculation_type: salaryRow.calculation_type,
            base_amount: Number(salaryRow.base_amount || 0),
            per_lecture_rate: Number(salaryRow.per_lecture_rate || 0),
          }
          : undefined;

        return {
          id: row.id,
          profile_id: row.profile_id,
          full_name: row.full_name,
          subject: row.subject,
          phone: row.phone || "",
          assigned_batches: assigned.length > 0 ? assigned : ["General Subject Batch"],
          is_active: row.is_active ?? true,
          is_demo: false,
          salary_config,
        };
      });

      return { data: mapped, isDemo: false };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch teachers", isDemo: false };
    }
  },

  async createTeacher(
    teacher: Omit<Teacher, "id" | "is_demo"> & {
      salary_config?: TeacherSalaryConfigData;
    }
  ): Promise<{ data: Teacher | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .insert({
          full_name: teacher.full_name,
          subject: teacher.subject,
          phone: teacher.phone,
          is_active: true,
          institute_id: INSTITUTE_ID,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (teacher.salary_config) {
        const { error: salaryErr } = await supabase
          .from("teacher_salary_configs")
          .upsert(
            {
              institute_id: INSTITUTE_ID,
              teacher_id: data.id,
              calculation_type: teacher.salary_config.calculation_type,
              base_amount: teacher.salary_config.base_amount,
              per_lecture_rate: teacher.salary_config.per_lecture_rate,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "teacher_id" }
          );

        if (salaryErr) {
          console.error("Failed to save teacher salary configuration:", salaryErr);
          return {
            data: null,
            error: `Teacher registered, but salary config failed: ${salaryErr.message}`,
          };
        }
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
          salary_config: teacher.salary_config,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  async updateTeacher(
    id: string,
    updates: Partial<Pick<Teacher, "full_name" | "subject" | "phone">> & {
      salary_config?: TeacherSalaryConfigData;
    }
  ): Promise<{ data: Teacher | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await supabase
        .from("teachers")
        .update({
          ...(updates.full_name && { full_name: updates.full_name }),
          ...(updates.subject && { subject: updates.subject }),
          ...(updates.phone && { phone: updates.phone }),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (updates.salary_config) {
        const { error: salaryErr } = await supabase
          .from("teacher_salary_configs")
          .upsert(
            {
              institute_id: INSTITUTE_ID,
              teacher_id: id,
              calculation_type: updates.salary_config.calculation_type,
              base_amount: updates.salary_config.base_amount,
              per_lecture_rate: updates.salary_config.per_lecture_rate,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "teacher_id" }
          );

        if (salaryErr) {
          console.error("Failed to update teacher salary configuration:", salaryErr);
          return {
            data: null,
            error: `Teacher updated, but salary config failed: ${salaryErr.message}`,
          };
        }
      }

      return {
        data: {
          id: data.id,
          full_name: data.full_name,
          subject: data.subject,
          phone: data.phone || "",
          assigned_batches: [],
          is_active: data.is_active ?? true,
          is_demo: false,
          salary_config: updates.salary_config,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  async deleteTeacher(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      // 1. Check if teacher has conducted class sessions
      const { count: sessionCount, error: countErr } = await supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", id);

      if (countErr) throw countErr;
      if (sessionCount && sessionCount > 0) {
        return {
          success: false,
          error: `Cannot delete faculty member with ${sessionCount} recorded class session(s). Please deactivate them instead to preserve historical academic records.`,
        };
      }

      // 2. Check if teacher has historical payroll disbursements
      const { count: payrollCount, error: payrollErr } = await supabase
        .from("teacher_payrolls")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", id);

      if (payrollErr) throw payrollErr;
      if (payrollCount && payrollCount > 0) {
        return {
          success: false,
          error: `Cannot delete faculty member with ${payrollCount} historical payroll record(s). Please deactivate them instead to preserve financial and tax records.`,
        };
      }

      // 3. Delete teacher (cascades to teacher_batches and teacher_salary_configs)
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete teacher" };
    }
  },

  async toggleTeacherStatus(
    id: string,
    currentStatus: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { error } = await supabase
        .from("teachers")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async assignTeacherToBatches(
    teacherId: string,
    batchIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      // 1. Delete existing associations
      const { error: delError } = await supabase
        .from("teacher_batches")
        .delete()
        .eq("teacher_id", teacherId);

      if (delError) {
        return { success: false, error: delError.message };
      }

      // 2. Insert new associations
      if (batchIds.length > 0) {
        const payload = batchIds.map((batchId) => ({
          teacher_id: teacherId,
          batch_id: batchId,
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
      return { success: false, error: err.message };
    }
  },
};
