export type StudentStatus =
  | "active"
  | "on_hold"
  | "alumni"
  | "rusticated"
  | "dropped_out"
  | "archived"
  | "Active"
  | "Inactive"
  | "On hold";

export type TeacherStatus = "active" | "on_leave" | "relieved";
export type BatchStatus = "active" | "completed" | "archived";

export interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  class_name: string;
  batch_name: string;
  batch_id?: string;
  profile_id?: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  city?: string;
  emergency_contact?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_relation?: string;
  parent_email?: string;
  notes?: string;
  photo_url?: string;
  is_profile_locked?: boolean;
  photo_uploaded_at?: string;
  status: StudentStatus;
  status_reason?: string;
  status_changed_at?: string;
  exit_date?: string;
  joined_on?: string;
  created_at?: string;
  updated_at?: string;
  institute_id?: string;
  is_demo?: boolean;
}

export interface TeacherSalaryConfigData {
  calculation_type: "monthly_fixed" | "per_lecture" | "hourly";
  base_amount: number;
  per_lecture_rate: number;
}

export interface Teacher {
  id: string;
  profile_id?: string;
  full_name: string;
  subject: string;
  phone: string;
  email?: string;
  assigned_batches: string[];
  is_active?: boolean;
  status?: TeacherStatus;
  status_reason?: string;
  status_changed_at?: string;
  relieving_date?: string;
  institute_id?: string;
  is_demo?: boolean;
  salary_config?: TeacherSalaryConfigData;
}

export interface BatchTeacherAssignment {
  id: string;
  full_name: string;
  subject: string;
}

export interface Batch {
  id: string;
  name: string;
  course_name: string;
  academic_year?: string;
  max_capacity: number;
  timing?: string;
  room_number?: string;
  start_date?: string;
  end_date?: string;
  status: BatchStatus;
  student_count?: number;
  capacity_percentage?: number;
  assigned_teachers?: string[];
  teacher_assignments?: BatchTeacherAssignment[];
  is_active?: boolean;
  institute_id?: string;
  is_demo?: boolean;
}

export interface StudentBatchHistory {
  id: string;
  student_id: string;
  from_batch_id?: string;
  from_batch_name?: string;
  to_batch_id: string;
  to_batch_name?: string;
  transfer_date: string;
  transferred_by?: string;
  reason?: string;
  created_at: string;
}

export interface StudentFilterParams {
  query?: string;
  batchId?: string;
  className?: string;
  status?: StudentStatus | "All";
  page?: number;
  pageSize?: number;
}





export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  table_name: string;
  record_id?: string;
  created_at: string;
}
