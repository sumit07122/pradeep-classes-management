import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Homework, StudyMaterial } from "../types";

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
          course_name: mat.course_name,
          subject: mat.subject,
          title: mat.title.trim(),
          description: mat.description?.trim() || null,
          file_url: mat.file_url,
          file_name: mat.file_name,
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
};
