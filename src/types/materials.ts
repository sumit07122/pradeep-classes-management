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
