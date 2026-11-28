import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Student, StudentFilterParams, StudentBatchHistory, StudentStatus } from "../types";

let mockClient: any = null;

export function setSupabaseClient(client: any) {
  mockClient = client;
}

function getClient(): any {
  return mockClient || supabase;
}

export interface LiveBatchOption {
  id: string;
  name: string;
  course_name: string;
  max_capacity: number;
  enrolled_count: number;
  status: string;
  is_available: boolean;
}

export const studentsService = {
  async getStudents(
    params?: StudentFilterParams
  ): Promise<{ data: Student[]; totalCount: number; error?: string; isDemo: boolean }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: [],
        totalCount: 0,
        error: "Database service is not configured.",
        isDemo: false,
      };
    }

    try {
      let query = supabase
        .from("students")
        .select("*", { count: "exact" });

      if (params?.query?.trim()) {
        const q = `%${params.query.trim()}%`;
        query = query.or(`full_name.ilike.${q},admission_no.ilike.${q},phone.ilike.${q},parent_name.ilike.${q}`);
      }

      if (params?.batchId && params.batchId !== "All") {
        query = query.eq("batch_id", params.batchId);
      }

      if (params?.className && params.className !== "All") {
        query = query.eq("class_name", params.className);
      }

      if (params?.status && params.status !== "All") {
        const raw = params.status.toLowerCase().replace(/\s+/g, "_");
        const dbStatus = raw === "inactive" ? "archived" : raw;
        query = query.eq("status", dbStatus);
      }

      query = query.order("created_at", { ascending: false });

      if (params?.page && params?.pageSize) {
        const from = (params.page - 1) * params.pageSize;
        const to = from + params.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error("Supabase students query error:", error.message);
        return { data: [], totalCount: 0, error: error.message, isDemo: false };
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
        email: row.email,
        date_of_birth: row.date_of_birth,
        gender: row.gender,
        address: row.address,
        city: row.city || "Mathura",
        emergency_contact: row.emergency_contact,
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        parent_relation: row.parent_relation,
        parent_email: row.parent_email,
        notes: row.notes,
        photo_url: row.photo_url,
        status: (row.status || "active") as StudentStatus,
        status_reason: row.status_reason || undefined,
        status_changed_at: row.status_changed_at || undefined,
        exit_date: row.exit_date || undefined,
        joined_on: row.joined_on,
        created_at: row.created_at,
        updated_at: row.updated_at,
        institute_id: row.institute_id,
        is_demo: false,
      }));

      return { data: mapped, totalCount: count || mapped.length, isDemo: false };
    } catch (err: any) {
      return { data: [], totalCount: 0, error: err?.message || "Failed to fetch students", isDemo: false };
    }
  },

  async getStudentById(id: string): Promise<{ data: Student | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const student: Student = {
        id: data.id,
        admission_no: data.admission_no,
        full_name: data.full_name,
        class_name: data.class_name,
        batch_name: data.batch_name || "Unassigned",
        batch_id: data.batch_id,
        profile_id: data.profile_id,
        phone: data.phone || "",
        email: data.email,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        address: data.address,
        city: data.city || "Mathura",
        emergency_contact: data.emergency_contact,
        parent_name: data.parent_name,
        parent_phone: data.parent_phone,
        parent_relation: data.parent_relation,
        parent_email: data.parent_email,
        notes: data.notes,
        photo_url: data.photo_url,
        status: (data.status || "active") as StudentStatus,
        status_reason: data.status_reason || undefined,
        status_changed_at: data.status_changed_at || undefined,
        exit_date: data.exit_date || undefined,
        joined_on: data.joined_on,
        created_at: data.created_at,
        updated_at: data.updated_at,
        institute_id: data.institute_id,
        is_demo: false,
      };

      return { data: student };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to fetch student details" };
    }
  },

  async getLiveBatches(): Promise<LiveBatchOption[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, name, course_name, max_capacity, status,
          students ( count )
        `)
        .eq("status", "active")
        .order("name");

      if (error) {
        console.error("Error fetching live batches:", error.message);
        return [];
      }

      return (data || []).map((b: any) => {
        const enrolled = b.students?.[0]?.count || 0;
        const maxCap = b.max_capacity || 40;
        return {
          id: b.id,
          name: b.name,
          course_name: b.course_name,
          max_capacity: maxCap,
          enrolled_count: enrolled,
          status: b.status,
          is_available: enrolled < maxCap,
        };
      });
    } catch {
      return [];
    }
  },

  async createStudent(
    student: Partial<Student>
  ): Promise<{ data: Student | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      // NOTE: We deliberately do NOT supply admission_no so PostgreSQL sequence trigger assigns it
      const payload: Record<string, any> = {
        full_name: student.full_name?.trim(),
        class_name: student.class_name,
        batch_id: student.batch_id || null,
        phone: student.phone?.trim() || null,
        email: student.email?.trim() || null,
        date_of_birth: student.date_of_birth || null,
        gender: student.gender || null,
        address: student.address?.trim() || null,
        city: student.city?.trim() || "Mathura",
        emergency_contact: student.emergency_contact?.trim() || null,
        parent_name: student.parent_name?.trim() || null,
        parent_phone: student.parent_phone?.trim() || null,
        parent_relation: student.parent_relation || "Parent",
        parent_email: student.parent_email?.trim() || null,
        notes: student.notes?.trim() || null,
        status: "active",
      };

      const { data, error } = await supabase
        .from("students")
        .insert(payload)
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
          batch_id: data.batch_id,
          phone: data.phone || "",
          email: data.email,
          parent_name: data.parent_name,
          parent_phone: data.parent_phone,
          status: "Active",
          is_demo: false,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to create student" };
    }
  },

  async updateStudent(
    id: string,
    updates: Partial<Student>
  ): Promise<{ data: Student | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database service is not configured." };
    }

    try {
      const payload: Record<string, any> = {};
      if (updates.full_name !== undefined) payload.full_name = updates.full_name.trim();
      if (updates.class_name !== undefined) payload.class_name = updates.class_name;
      if (updates.phone !== undefined) payload.phone = updates.phone.trim();
      if (updates.email !== undefined) payload.email = updates.email?.trim() || null;
      if (updates.date_of_birth !== undefined) payload.date_of_birth = updates.date_of_birth || null;
      if (updates.gender !== undefined) payload.gender = updates.gender || null;
      if (updates.address !== undefined) payload.address = updates.address?.trim() || null;
      if (updates.city !== undefined) payload.city = updates.city?.trim() || "Mathura";
      if (updates.emergency_contact !== undefined) payload.emergency_contact = updates.emergency_contact?.trim() || null;
      if (updates.parent_name !== undefined) payload.parent_name = updates.parent_name?.trim() || null;
      if (updates.parent_phone !== undefined) payload.parent_phone = updates.parent_phone?.trim() || null;
      if (updates.parent_relation !== undefined) payload.parent_relation = updates.parent_relation;
      if (updates.parent_email !== undefined) payload.parent_email = updates.parent_email?.trim() || null;
      if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;
      if (updates.status !== undefined) {
        payload.status =
          updates.status === "Active"
            ? "active"
            : updates.status === "On hold"
            ? "on_hold"
            : "inactive";
      }

      const { data, error } = await supabase
        .from("students")
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
          admission_no: data.admission_no,
          full_name: data.full_name,
          class_name: data.class_name,
          batch_name: data.batch_name,
          batch_id: data.batch_id,
          phone: data.phone || "",
          status:
            data.status === "active"
              ? "Active"
              : data.status === "on_hold"
              ? "On hold"
              : "Inactive",
          is_demo: false,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to update student" };
    }
  },

  async archiveStudent(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { error } = await supabase
        .from("students")
        .update({ status: "inactive" })
        .eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to archive student" };
    }
  },

  async transferBatch(
    studentId: string,
    toBatchId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await supabase.rpc("transfer_student_batch", {
        p_student_id: studentId,
        p_to_batch_id: toBatchId,
        p_reason: reason || "Administrative batch reallocation",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || "Batch transfer failed" };
    }
  },

  async getStudentBatchHistory(
    studentId: string
  ): Promise<{ data: StudentBatchHistory[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [] };
    }

    try {
      const { data, error } = await supabase
        .from("student_batch_history")
        .select(`
          id, student_id, from_batch_id, to_batch_id, transfer_date, transferred_by, reason, created_at,
          from_batch:batches!from_batch_id ( name ),
          to_batch:batches!to_batch_id ( name )
        `)
        .eq("student_id", studentId)
        .order("transfer_date", { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      const mapped: StudentBatchHistory[] = (data || []).map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        from_batch_id: row.from_batch_id,
        from_batch_name: row.from_batch?.name || "Unassigned",
        to_batch_id: row.to_batch_id,
        to_batch_name: row.to_batch?.name || "Unknown Batch",
        transfer_date: row.transfer_date,
        transferred_by: row.transferred_by,
        reason: row.reason,
        created_at: row.created_at,
      }));

      return { data: mapped };
    } catch (err: any) {
      return { data: [], error: err?.message || "Failed to fetch student transfer history" };
    }
  },

  async deleteStudent(
    id: string,
    forceCascade: boolean = false
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    const client = getClient();
    if (!client) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const { data, error } = await client.rpc("admin_delete_student", {
        p_student_id: id,
        p_force_cascade: forceCascade,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && typeof data === "object" && data.success === false) {
        return {
          success: false,
          error: data.error || data.message || "Failed to delete student",
        };
      }

      return {
        success: true,
        message: data?.message || "Student deleted successfully",
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete student" };
    }
  },

  async updateStudentStatus(
    id: string,
    status: StudentStatus,
    reason?: string,
    exitDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = getClient();
    if (!client) {
      return { success: false, error: "Database service is not configured." };
    }

    try {
      const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_");
      const isExitStatus = [
        "alumni",
        "rusticated",
        "dropped_out",
        "archived",
      ].includes(normalizedStatus);

      const payload: any = {
        status: normalizedStatus,
        status_reason: reason || null,
        status_changed_at: new Date().toISOString(),
        exit_date:
          exitDate ||
          (isExitStatus ? new Date().toISOString().split("T")[0] : null),
      };

      const { error } = await client
        .from("students")
        .update(payload)
        .eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to update student status",
      };
    }
  },

  /**
   * Upload passport photo from student account and permanently lock photo, name, and phone
   */
  async uploadStudentPhotoAndLock(
    studentId: string,
    file: File
  ): Promise<{ success: boolean; photo_url?: string; error?: string }> {
    if (!supabase) return { success: false, error: "Database not configured." };
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${studentId}_${Date.now()}.${ext}`;
      const filePath = `photos/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("student-photos")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        throw uploadErr;
      }

      const { data: publicUrlData } = supabase.storage
        .from("student-photos")
        .getPublicUrl(filePath);

      const photoUrl = publicUrlData.publicUrl;

      const { error: rpcErr } = await supabase.rpc("lock_student_profile", {
        p_student_id: studentId,
        p_photo_url: photoUrl,
      });

      if (rpcErr) {
        console.error("Lock student profile error:", rpcErr);
        throw rpcErr;
      }

      return { success: true, photo_url: photoUrl };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to upload photo and lock profile." };
    }
  },

  setSupabaseClient,
};

export const deleteStudent = studentsService.deleteStudent;
export const updateStudentStatus = studentsService.updateStudentStatus;
