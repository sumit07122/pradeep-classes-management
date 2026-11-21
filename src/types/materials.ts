export interface Homework {
  id: string;
  institute_id: string;
  batch_id: string;
  batch_name?: string;
  title: string;
  subject?: string;
  description?: string | null;
  due_date: string;
  max_marks?: number | null;
  attachment_url?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface StudyMaterial {
  id: string;
  institute_id: string;
  batch_id?: string | null;
  batch_name?: string | null;
  course_name?: string;
  subject: string;
  title: string;
  description?: string | null;
  category?: string;
  file_url: string;
  file_name?: string;
  file_size_bytes?: number | null;
  file_size_kb?: number | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface StudentDoubt {
  id: string;
  institute_id: string;
  student_id: string;
  student_name?: string;
  batch_id?: string | null;
  batch_name?: string;
  subject: string;
  topic?: string | null;
  question: string;
  attachment_url?: string | null;
  status: "pending" | "in_review" | "resolved";
  response?: string | null;
  responded_by?: string | null;
  responder_name?: string;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeworkSubmission {
  id: string;
  institute_id: string;
  homework_id: string;
  homework_title?: string;
  student_id: string;
  student_name?: string;
  submission_text?: string | null;
  file_url?: string | null;
  status: "submitted" | "graded" | "returned" | "resubmit";
  grade?: string | null;
  remarks?: string | null;
  submitted_at: string;
  graded_at?: string | null;
  graded_by?: string | null;
}
