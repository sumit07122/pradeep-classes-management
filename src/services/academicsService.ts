import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Exam, ExamMark, CreateExamDTO, StudentExamResult } from "../types";

export const academicsService = {
  async getExams(batchId?: string): Promise<{ data: Exam[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [] };
    }

    try {
      let query = supabase
        .from("exams")
        .select(`
          id, institute_id, batch_id, title, subject, exam_type,
          exam_date, start_time, duration_minutes, total_marks,
          passing_marks, status, created_by, created_at,
          batches ( name )
        `)
        .order("exam_date", { ascending: false });

      if (batchId) {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const exams: Exam[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        batch_id: row.batch_id,
        batch_name: row.batches?.name || "Assigned Batch",
        title: row.title,
        subject: row.subject,
        exam_type: row.exam_type,
        exam_date: row.exam_date,
        start_time: row.start_time,
        duration_minutes: row.duration_minutes,
        total_marks: Number(row.total_marks),
        passing_marks: Number(row.passing_marks),
        status: row.status,
        is_published: row.status === "published",
        created_by: row.created_by,
        created_at: row.created_at,
      }));

      return { data: exams };
    } catch (err: any) {
      console.error("Error fetching exams:", err);
      return { data: [], error: err.message || "Failed to load exams" };
    }
  },

  async createExam(dto: CreateExamDTO): Promise<{ data: Exam | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database not configured" };
    }

    try {
      const { data: profile } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("institute_id")
        .eq("id", profile.user?.id)
        .single();

      const instId = userProfile?.institute_id || "11111111-2222-3333-4444-555555555555";

      const { data, error } = await supabase
        .from("exams")
        .insert({
          institute_id: instId,
          batch_id: dto.batch_id,
          title: dto.title.trim(),
          subject: dto.subject,
          exam_type: dto.exam_type || "unit_test",
          exam_date: dto.exam_date,
          start_time: dto.start_time || null,
          duration_minutes: dto.duration_minutes || 60,
          total_marks: dto.total_marks,
          passing_marks: dto.passing_marks,
          status: "scheduled",
          created_by: profile.user?.id,
        })
        .select("*, batches(name)")
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          batch_id: data.batch_id,
          batch_name: data.batches?.name || "Assigned Batch",
          title: data.title,
          subject: data.subject,
          exam_type: data.exam_type,
          exam_date: data.exam_date,
          start_time: data.start_time,
          duration_minutes: data.duration_minutes,
          total_marks: Number(data.total_marks),
          passing_marks: Number(data.passing_marks),
          status: data.status,
          is_published: data.status === "published",
          created_by: data.created_by,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to create exam" };
    }
  },

  async updateExam(
    id: string,
    updates: Partial<CreateExamDTO>
  ): Promise<{ data: Exam | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database not configured" };
    }
    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.subject !== undefined) payload.subject = updates.subject;
      if (updates.exam_date !== undefined) payload.exam_date = updates.exam_date;
      if (updates.total_marks !== undefined) payload.total_marks = Number(updates.total_marks);
      if (updates.passing_marks !== undefined) payload.passing_marks = Number(updates.passing_marks);
      if (updates.duration_minutes !== undefined) payload.duration_minutes = Number(updates.duration_minutes);
      if (updates.exam_type !== undefined) payload.exam_type = updates.exam_type;

      const { data, error } = await supabase
        .from("exams")
        .update(payload)
        .eq("id", id)
        .select("*, batches(name)")
        .single();

      if (error) throw error;
      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          batch_id: data.batch_id,
          batch_name: data.batches?.name || "Assigned Batch",
          title: data.title,
          subject: data.subject,
          exam_type: data.exam_type,
          exam_date: data.exam_date,
          start_time: data.start_time,
          duration_minutes: data.duration_minutes,
          total_marks: Number(data.total_marks),
          passing_marks: Number(data.passing_marks),
          status: data.status,
          is_published: data.status === "published",
          created_by: data.created_by,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to update exam" };
    }
  },

  async deleteExam(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }
    try {
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete exam" };
    }
  },

  async getExamMarks(examId: string): Promise<{ data: ExamMark[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      const { data, error } = await supabase
        .from("exam_marks")
        .select(`
          id, institute_id, exam_id, student_id, marks_obtained,
          is_absent, percentage, grade, rank_in_batch, remarks,
          entered_by, updated_at,
          students ( full_name, admission_no )
        `)
        .eq("exam_id", examId)
        .order("rank_in_batch", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const marks: ExamMark[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        exam_id: row.exam_id,
        student_id: row.student_id,
        student_name: row.students?.full_name || "Student",
        admission_no: row.students?.admission_no || "",
        marks_obtained: row.marks_obtained !== null ? Number(row.marks_obtained) : 0,
        is_absent: row.is_absent,
        percentage: row.percentage !== null ? Number(row.percentage) : 0,
        grade: row.grade || "F",
        rank: row.rank_in_batch || undefined,
        rank_in_batch: row.rank_in_batch,
        remarks: row.remarks,
        entered_by: row.entered_by,
        updated_at: row.updated_at,
      }));

      return { data: marks };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load marks" };
    }
  },

  async submitExamMarks(
    examId: string,
    marks: {
      student_id: string;
      marks_obtained?: number | null;
      is_absent?: boolean;
      remarks?: string;
    }[]
  ): Promise<{ success: boolean; total_marked?: number; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const { data, error } = await supabase.rpc("submit_exam_marks", {
        p_exam_id: examId,
        p_marks: marks,
      });

      if (error) throw error;
      return { success: true, total_marked: data?.total_marked };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to save exam marks" };
    }
  },

  async submitMarks(
    examId: string,
    marks: {
      student_id: string;
      marks_obtained?: number | null;
      is_absent?: boolean;
      remarks?: string;
    }[]
  ): Promise<{ success: boolean; total_marked?: number; error?: string }> {
    return this.submitExamMarks(examId, marks);
  },

  async publishExamResults(examId: string, isPublished: boolean = true): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      if (isPublished) {
        const { data, error } = await supabase.rpc("publish_exam_results", {
          p_exam_id: examId,
        });
        if (error) throw error;
        return { success: data?.success ?? true };
      } else {
        const { error } = await supabase
          .from("exams")
          .update({ status: "completed" })
          .eq("id", examId);
        if (error) throw error;
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to publish results" };
    }
  },

  async publishResults(examId: string, isPublished: boolean = true): Promise<{ success: boolean; error?: string }> {
    return this.publishExamResults(examId, isPublished);
  },

  async getStudentExamResults(studentId: string): Promise<StudentExamResult[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from("exam_marks")
        .select(`
          exam_id, marks_obtained, is_absent, percentage, grade, rank_in_batch,
          exams ( title, subject, exam_date, total_marks, passing_marks, status )
        `)
        .eq("student_id", studentId);

      if (error) throw error;

      return (data || [])
        .filter((row: any) => row.exams?.status === "published")
        .map((row: any) => ({
          exam_id: row.exam_id,
          exam_title: row.exams?.title || "Exam",
          subject: row.exams?.subject || "Subject",
          exam_date: row.exams?.exam_date || "",
          marks_obtained: Number(row.marks_obtained) || 0,
          total_marks: Number(row.exams?.total_marks) || 100,
          percentage: Number(row.percentage) || 0,
          grade: row.grade || "F",
          rank: row.rank_in_batch || undefined,
          is_absent: Boolean(row.is_absent),
          is_passed: Number(row.marks_obtained) >= Number(row.exams?.passing_marks || 40),
        }));
    } catch (err: any) {
      console.error("Error loading student exam results:", err);
      return [];
    }
  },
};
