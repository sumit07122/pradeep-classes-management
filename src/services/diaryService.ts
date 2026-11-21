import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type {
  ClassSession,
  CreateClassDiaryDTO,
  SyllabusChapter,
  StudentStreak,
  StudentBadge,
  StudentPointsRecord,
  StudentCertificate,
} from "../types/diary";

const DEFAULT_INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

export const diaryService = {
  /**
   * Fetch conducted and scheduled class sessions with their linked class diary
   */
  async getClassSessions(batchId?: string): Promise<{ data: ClassSession[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [] };
    }

    try {
      let query = supabase
        .from("class_sessions")
        .select(`
          *,
          batches ( name ),
          teachers ( full_name ),
          class_diaries ( * )
        `)
        .order("session_date", { ascending: false });

      if (batchId && batchId !== "all") {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const sessions: ClassSession[] = (data || []).map((row: any) => ({
        id: row.id,
        institute_id: row.institute_id,
        batch_id: row.batch_id,
        batch_name: row.batches?.name || "Assigned Batch",
        teacher_id: row.teacher_id,
        teacher_name: row.teachers?.full_name || "Faculty Member",
        subject: row.subject,
        session_date: row.session_date,
        start_time: row.start_time,
        end_time: row.end_time,
        actual_duration_minutes: row.actual_duration_minutes || 90,
        status: row.status,
        diary: row.class_diaries && row.class_diaries.length > 0 ? row.class_diaries[0] : undefined,
        created_at: row.created_at,
      }));

      return { data: sessions };
    } catch (err: any) {
      console.error("Error fetching class sessions:", err);
      return { data: [], error: err.message || "Failed to load class sessions" };
    }
  },

  /**
   * Submit an official Class Diary record for a conducted lecture
   */
  async submitClassDiary(dto: CreateClassDiaryDTO): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;

      // Find teacher_id if not explicitly provided
      let teacherId = dto.teacher_id;
      if (!teacherId && userId) {
        const { data: tData } = await supabase
          .from("teachers")
          .select("id")
          .eq("profile_id", userId)
          .maybeSingle();
        teacherId = tData?.id;
      }

      // If still not found, fetch any active teacher
      if (!teacherId) {
        const { data: anyTeacher } = await supabase
          .from("teachers")
          .select("id")
          .limit(1)
          .single();
        teacherId = anyTeacher?.id;
      }

      // 1. Create class session
      const { data: session, error: sessErr } = await supabase
        .from("class_sessions")
        .insert({
          institute_id: DEFAULT_INSTITUTE_ID,
          batch_id: dto.batch_id,
          teacher_id: teacherId,
          subject: dto.subject,
          session_date: dto.session_date,
          start_time: dto.start_time,
          end_time: dto.end_time,
          actual_duration_minutes: dto.actual_duration_minutes || 90,
          status: "conducted",
        })
        .select()
        .single();

      if (sessErr) throw sessErr;

      // 2. Create class diary entry
      const { error: diaryErr } = await supabase
        .from("class_diaries")
        .insert({
          institute_id: DEFAULT_INSTITUTE_ID,
          session_id: session.id,
          chapter_name: dto.chapter_name.trim(),
          topics_covered: dto.topics_covered.trim(),
          teaching_remarks: dto.teaching_remarks?.trim() || null,
          next_planned_topic: dto.next_planned_topic?.trim() || null,
          homework_notes: dto.homework_notes?.trim() || null,
          is_draft: false,
          created_by: userId,
        });

      if (diaryErr) throw diaryErr;

      return { success: true };
    } catch (err: any) {
      console.error("Error submitting class diary:", err);
      return { success: false, error: err.message || "Failed to record class diary" };
    }
  },

  /**
   * Update an existing Class Session and linked Class Diary record
   */
  async updateClassDiary(
    sessionId: string,
    diaryId?: string,
    dto?: Partial<CreateClassDiaryDTO>
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      if (dto) {
        // 1. Update session fields
        if (
          dto.batch_id ||
          dto.subject ||
          dto.session_date ||
          dto.start_time ||
          dto.end_time ||
          dto.actual_duration_minutes !== undefined
        ) {
          const { error: sessErr } = await supabase
            .from("class_sessions")
            .update({
              ...(dto.batch_id && { batch_id: dto.batch_id }),
              ...(dto.subject && { subject: dto.subject }),
              ...(dto.session_date && { session_date: dto.session_date }),
              ...(dto.start_time && { start_time: dto.start_time }),
              ...(dto.end_time && { end_time: dto.end_time }),
              ...(dto.actual_duration_minutes !== undefined && {
                actual_duration_minutes: dto.actual_duration_minutes,
              }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);

          if (sessErr) throw sessErr;
        }

        // 2. Update diary fields
        if (diaryId) {
          const { error: diaryErr } = await supabase
            .from("class_diaries")
            .update({
              ...(dto.chapter_name !== undefined && { chapter_name: dto.chapter_name.trim() }),
              ...(dto.topics_covered !== undefined && { topics_covered: dto.topics_covered.trim() }),
              ...(dto.teaching_remarks !== undefined && {
                teaching_remarks: dto.teaching_remarks?.trim() || null,
              }),
              ...(dto.next_planned_topic !== undefined && {
                next_planned_topic: dto.next_planned_topic?.trim() || null,
              }),
              ...(dto.homework_notes !== undefined && {
                homework_notes: dto.homework_notes?.trim() || null,
              }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", diaryId);

          if (diaryErr) throw diaryErr;
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error("Error updating class diary:", err);
      return { success: false, error: err.message || "Failed to update class diary" };
    }
  },

  /**
   * Delete a Class Session and its cascaded Class Diary record
   */
  async deleteClassDiary(sessionId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const { error } = await supabase
        .from("class_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error("Error deleting class diary:", err);
      return { success: false, error: err.message || "Failed to delete class diary" };
    }
  },

  /**
   * Fetch complete syllabus chapters & topics with batch progress
   */
  async getSyllabusWithProgress(batchId?: string): Promise<{ data: SyllabusChapter[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: [] };
    }

    try {
      const [chapRes, topRes, progRes] = await Promise.all([
        supabase.from("syllabus_chapters").select("*").order("chapter_no"),
        supabase.from("syllabus_topics").select("*").order("topic_no"),
        batchId && batchId !== "all"
          ? supabase.from("batch_topic_progress").select("*").eq("batch_id", batchId)
          : supabase.from("batch_topic_progress").select("*"),
      ]);

      if (chapRes.error) throw chapRes.error;

      const progressMap = new Map<string, any>();
      (progRes.data || []).forEach((p: any) => {
        progressMap.set(p.topic_id, p);
      });

      const chapters: SyllabusChapter[] = (chapRes.data || []).map((ch: any) => {
        const topics = (topRes.data || [])
          .filter((t: any) => t.chapter_id === ch.id)
          .map((t: any) => {
            const prog = progressMap.get(t.id);
            return {
              id: t.id,
              chapter_id: t.chapter_id,
              topic_no: t.topic_no,
              title: t.title,
              description: t.description,
              status: prog?.status || "not_started",
              completed_on: prog?.completed_on || null,
            };
          });

        return {
          id: ch.id,
          course_name: ch.course_name,
          subject: ch.subject,
          chapter_no: ch.chapter_no,
          title: ch.title,
          total_estimated_hours: Number(ch.total_estimated_hours) || 10,
          topics,
        };
      });

      return { data: chapters };
    } catch (err: any) {
      console.error("Error loading syllabus:", err);
      return { data: [], error: err.message || "Failed to load syllabus" };
    }
  },

  /**
   * Update progress status of a specific syllabus topic for a batch
   */
  async updateTopicProgress(
    batchId: string,
    topicId: string,
    status: string,
    remarks?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Database not configured" };
    }

    try {
      const { error } = await supabase
        .from("batch_topic_progress")
        .upsert(
          {
            institute_id: DEFAULT_INSTITUTE_ID,
            batch_id: batchId,
            topic_id: topicId,
            status,
            completed_on: status === "completed" ? new Date().toISOString().split("T")[0] : null,
            teacher_remarks: remarks || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "batch_id,topic_id" }
        );

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch student streaks, badges, and points history
   */
  async getStudentGamification(studentId: string): Promise<{
    streak: StudentStreak | null;
    badges: StudentBadge[];
    points: StudentPointsRecord[];
    totalPoints: number;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { streak: null, badges: [], points: [], totalPoints: 0 };
    }

    try {
      const [streakRes, badgeRes, pointRes] = await Promise.all([
        supabase.from("student_streaks").select("*").eq("student_id", studentId).maybeSingle(),
        supabase.from("student_badges").select("*").eq("student_id", studentId).order("earned_at", { ascending: false }),
        supabase.from("student_points_ledger").select("*").eq("student_id", studentId).order("created_at", { ascending: false }),
      ]);

      const points = (pointRes.data || []).map((p: any) => ({
        id: p.id,
        points: Number(p.points),
        event_type: p.event_type,
        reason: p.reason,
        created_at: p.created_at,
      }));

      const totalPoints = points.reduce((sum, p) => sum + p.points, 0);

      return {
        streak: streakRes.data
          ? {
              current_attendance_streak: streakRes.data.current_attendance_streak,
              longest_attendance_streak: streakRes.data.longest_attendance_streak,
              last_attended_date: streakRes.data.last_attended_date,
            }
          : null,
        badges: badgeRes.data || [],
        points,
        totalPoints,
      };
    } catch (err) {
      console.error("Error loading student gamification:", err);
      return { streak: null, badges: [], points: [], totalPoints: 0 };
    }
  },

  /**
   * Fetch verified student certificates
   */
  async getStudentCertificates(studentId: string): Promise<StudentCertificate[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from("student_certificates")
        .select("*")
        .eq("student_id", studentId)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        certificate_no: c.certificate_no,
        certificate_type: c.certificate_type,
        title: c.title,
        course_name: c.course_name,
        issue_date: c.issue_date,
        signatory_title: c.signatory_title,
        verification_token: c.verification_token,
      }));
    } catch (err) {
      console.error("Error loading certificates:", err);
      return [];
    }
  },
};
