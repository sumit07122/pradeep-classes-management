import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Homework, StudyMaterial, StudentDoubt, HomeworkSubmission } from "../types";

export const materialsService = {
  async getHomework(batchId?: string): Promise<{ data: Homework[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("homework")
        .select(`
          id, institute_id, batch_id, title, subject, description,
          due_date, attachment_url, created_by, created_at,
          batches ( name )
        `)
        .order("due_date", { ascending: false });

      if (batchId) {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items: Homework[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        batch_id: row.batch_id,
        batch_name: row.batches?.name || "Assigned Batch",
        title: row.title,
        subject: row.subject,
        description: row.description,
        due_date: row.due_date,
        attachment_url: row.attachment_url,
        created_by: row.created_by,
        created_at: row.created_at,
      }));

      return { data: items };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load homework" };
    }
  },

  async createHomework(
    hw: Omit<Homework, "id" | "created_at" | "institute_id">
  ): Promise<{ data: Homework | null; error?: string }> {
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
        .from("homework")
        .insert({
          institute_id: instId,
          batch_id: hw.batch_id,
          title: hw.title.trim(),
          subject: hw.subject || "General",
          description: hw.description?.trim() || null,
          due_date: hw.due_date,
          attachment_url: hw.attachment_url || null,
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
          description: data.description,
          due_date: data.due_date,
          attachment_url: data.attachment_url,
          created_by: data.created_by,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to create homework" };
    }
  },

  async getStudyMaterials(batchId?: string): Promise<{ data: StudyMaterial[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("study_materials")
        .select(`
          id, institute_id, batch_id, course_name, subject,
          title, description, file_url, file_name, file_size_kb,
          uploaded_by, created_at,
          batches ( name )
        `)
        .order("created_at", { ascending: false });

      if (batchId) {
        query = query.or(`batch_id.is.null,batch_id.eq.${batchId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items: StudyMaterial[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        batch_id: row.batch_id,
        batch_name: row.batches?.name || (row.batch_id ? "Specific Batch" : "All Batches"),
        course_name: row.course_name,
        subject: row.subject,
        title: row.title,
        description: row.description,
        file_url: row.file_url,
        file_name: row.file_name,
        file_size_kb: row.file_size_kb ? Number(row.file_size_kb) : null,
        uploaded_by: row.uploaded_by,
        created_at: row.created_at,
      }));

      return { data: items };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load study materials" };
    }
  },

  async createStudyMaterial(
    mat: Omit<StudyMaterial, "id" | "created_at" | "institute_id">
  ): Promise<{ data: StudyMaterial | null; error?: string }> {
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
        .from("study_materials")
        .insert({
          institute_id: instId,
          batch_id: mat.batch_id || null,
          course_name: mat.course_name?.trim() || "JEE / NEET",
          subject: mat.subject || "General",
          title: mat.title.trim(),
          description: mat.description?.trim() || null,
          file_url: mat.file_url,
          file_name: mat.file_name?.trim() || `${mat.title.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`,
          file_size_kb: mat.file_size_kb || null,
          uploaded_by: profile.user?.id,
        })
        .select("*, batches(name)")
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          institute_id: data.institute_id,
          batch_id: data.batch_id,
          batch_name: data.batches?.name || (data.batch_id ? "Specific Batch" : "All Batches"),
          course_name: data.course_name,
          subject: data.subject,
          title: data.title,
          description: data.description,
          file_url: data.file_url,
          file_name: data.file_name,
          file_size_kb: data.file_size_kb ? Number(data.file_size_kb) : null,
          uploaded_by: data.uploaded_by,
          created_at: data.created_at,
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to upload study material record" };
    }
  },

  async uploadFile(file: File): Promise<{ url: string | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { url: null, error: "Database not configured" };

    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("materials").getPublicUrl(filePath);
      return { url: data.publicUrl };
    } catch (err: any) {
      return { url: null, error: err.message || "File upload failed" };
    }
  },

  /**
   * Fetch doubts for a student, a batch, or the institute
   */
  async getStudentDoubts(studentId?: string, batchId?: string): Promise<{ data: StudentDoubt[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("student_doubts")
        .select(`
          id, institute_id, student_id, batch_id, subject, topic,
          question, attachment_url, status, response, responded_by,
          responded_at, created_at, updated_at,
          students ( full_name, admission_no ),
          batches ( name )
        `)
        .order("created_at", { ascending: false });

      if (studentId) {
        query = query.eq("student_id", studentId);
      }
      if (batchId && batchId !== "all") {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items: StudentDoubt[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        student_id: row.student_id,
        student_name: row.students?.full_name || "Student",
        batch_id: row.batch_id,
        batch_name: row.batches?.name || "Batch",
        subject: row.subject,
        topic: row.topic,
        question: row.question,
        attachment_url: row.attachment_url,
        status: row.status as any,
        response: row.response,
        responded_by: row.responded_by,
        responded_at: row.responded_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return { data: items };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load student doubts" };
    }
  },

  /**
   * Submit a student doubt
   */
  async createStudentDoubt(payload: {
    student_id: string;
    batch_id?: string | null;
    subject: string;
    topic?: string;
    question: string;
    attachment_url?: string;
  }): Promise<{ data: StudentDoubt | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: null, error: "Database not configured" };

    try {
      const { data, error } = await supabase
        .from("student_doubts")
        .insert({
          student_id: payload.student_id,
          batch_id: payload.batch_id || null,
          subject: payload.subject,
          topic: payload.topic?.trim() || null,
          question: payload.question.trim(),
          attachment_url: payload.attachment_url || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return { data: data as StudentDoubt };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to post doubt" };
    }
  },

  /**
   * Faculty response to a student doubt
   */
  async respondToDoubt(
    doubtId: string,
    response: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: "Database not configured" };

    try {
      const { data: userProfile } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("student_doubts")
        .update({
          response: response.trim(),
          status: "resolved",
          responded_by: userProfile.user?.id || null,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", doubtId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to submit response" };
    }
  },

  /**
   * Fetch submissions for homework
   */
  async getHomeworkSubmissions(
    homeworkId?: string,
    studentId?: string
  ): Promise<{ data: HomeworkSubmission[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { data: [] };

    try {
      let query = supabase
        .from("homework_submissions")
        .select(`
          id, institute_id, homework_id, student_id, submission_text,
          file_url, status, grade, remarks, submitted_at, graded_at, graded_by,
          students ( full_name ),
          homework ( title )
        `)
        .order("submitted_at", { ascending: false });

      if (homeworkId) query = query.eq("homework_id", homeworkId);
      if (studentId) query = query.eq("student_id", studentId);

      const { data, error } = await query;
      if (error) throw error;

      const items: HomeworkSubmission[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        homework_id: row.homework_id,
        homework_title: row.homework?.title || "Homework",
        student_id: row.student_id,
        student_name: row.students?.full_name || "Student",
        submission_text: row.submission_text,
        file_url: row.file_url,
        status: row.status as any,
        grade: row.grade,
        remarks: row.remarks,
        submitted_at: row.submitted_at,
        graded_at: row.graded_at,
        graded_by: row.graded_by,
      }));

      return { data: items };
    } catch (err: any) {
      return { data: [], error: err.message || "Failed to load submissions" };
    }
  },

  /**
   * Submit homework solution by student
   */
  async submitHomework(payload: {
    homework_id: string;
    student_id: string;
    submission_text?: string;
    file_url?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: "Database not configured" };

    try {
      const { error } = await supabase
        .from("homework_submissions")
        .upsert(
          {
            homework_id: payload.homework_id,
            student_id: payload.student_id,
            submission_text: payload.submission_text?.trim() || null,
            file_url: payload.file_url || null,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          },
          { onConflict: "homework_id,student_id" }
        );

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to submit homework" };
    }
  },

  /**
   * Grade a homework submission by teacher/admin
   */
  async gradeHomeworkSubmission(
    submissionId: string,
    payload: { grade: string; remarks?: string; status?: "graded" | "returned" }
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: "Database not configured" };

    try {
      const { data: userProfile } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("homework_submissions")
        .update({
          grade: payload.grade.trim(),
          remarks: payload.remarks?.trim() || null,
          status: payload.status || "graded",
          graded_at: new Date().toISOString(),
          graded_by: userProfile.user?.id || null,
        })
        .eq("id", submissionId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to grade submission" };
    }
  },
};
