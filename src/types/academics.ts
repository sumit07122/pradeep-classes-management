export type ExamType = "weekly_test" | "unit_test" | "mock_exam" | "term_exam" | "board_practice";
export type ExamStatus = "draft" | "scheduled" | "completed" | "published";

export interface Exam {
  id: string;
  institute_id: string;
  batch_id: string;
  batch_name?: string;
  title: string;
  subject: string;
  exam_type?: ExamType;
  exam_date: string;
  start_time?: string | null;
  duration_minutes?: number;
  total_marks: number;
  passing_marks: number;
  status?: ExamStatus;
  is_published: boolean;
  created_by?: string | null;
  created_at: string;
  total_students_enrolled?: number;
  total_marks_entered?: number;
}

export interface ExamMark {
  id: string;
  institute_id: string;
  exam_id: string;
  student_id: string;
  student_name?: string;
  admission_no?: string;
  marks_obtained: number;
  is_absent: boolean;
  percentage: number;
  grade: string;
  rank?: number;
  rank_in_batch?: number;
  is_passed?: boolean;
  remarks?: string | null;
  entered_by?: string | null;
  updated_at?: string;
}

export type ExamMarkRecord = ExamMark;

export interface CreateExamDTO {
  batch_id: string;
  title: string;
  subject: string;
  exam_date: string;
  total_marks: number;
  passing_marks: number;
  exam_type?: ExamType;
  start_time?: string;
  duration_minutes?: number;
}

export interface StudentExamResult {
  exam_id: string;
  exam_title: string;
  subject: string;
  exam_date: string;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  rank?: number;
  is_absent: boolean;
  is_passed: boolean;
}
