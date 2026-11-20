// src/types/diary.ts
// Phase 2 & 3 Domain Models for Academic Delivery, Class Diary, Syllabus & Gamification

export interface ClassSession {
  id: string;
  institute_id: string;
  batch_id: string;
  batch_name?: string;
  timetable_id?: string | null;
  teacher_id: string;
  teacher_name?: string;
  subject: string;
  session_date: string;
  start_time: string;
  end_time: string;
  actual_duration_minutes: number;
  status: 'scheduled' | 'conducted' | 'cancelled' | 'rescheduled';
  diary?: ClassDiary;
  created_at: string;
}

export interface ClassDiary {
  id: string;
  institute_id: string;
  session_id: string;
  chapter_name: string;
  topics_covered: string;
  teaching_remarks?: string | null;
  next_planned_topic?: string | null;
  homework_notes?: string | null;
  is_draft: boolean;
  submitted_at: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClassDiaryDTO {
  batch_id: string;
  teacher_id?: string;
  subject: string;
  session_date: string;
  start_time: string;
  end_time: string;
  actual_duration_minutes?: number;
  chapter_name: string;
  topics_covered: string;
  teaching_remarks?: string;
  next_planned_topic?: string;
  homework_notes?: string;
}

export interface SyllabusChapter {
  id: string;
  course_name: string;
  subject: string;
  chapter_no: number;
  title: string;
  total_estimated_hours: number;
  topics?: SyllabusTopic[];
}

export interface SyllabusTopic {
  id: string;
  chapter_id: string;
  topic_no: number;
  title: string;
  description?: string;
  status?: 'not_started' | 'planned' | 'in_progress' | 'completed' | 'needs_revision';
  completed_on?: string | null;
}

export interface StudentStreak {
  current_attendance_streak: number;
  longest_attendance_streak: number;
  last_attended_date: string;
}

export interface StudentBadge {
  id: string;
  badge_code: string;
  badge_name: string;
  description: string;
  icon_name: string;
  earned_at: string;
}

export interface StudentPointsRecord {
  id: string;
  points: number;
  event_type: string;
  reason: string;
  created_at: string;
}

export interface StudentCertificate {
  id: string;
  certificate_no: string;
  certificate_type: string;
  title: string;
  course_name: string;
  issue_date: string;
  signatory_title: string;
  verification_token: string;
}
