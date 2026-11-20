export type StudentStatus = "Active" | "Inactive" | "On hold";
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
  status: StudentStatus;
  joined_on?: string;
  created_at?: string;
  updated_at?: string;
  institute_id?: string;
  is_demo?: boolean;
}

export interface Teacher {
  id: string;
  profile_id?: string;
  full_name: string;
  subject: string;
  phone: string;
  assigned_batches: string[];
  is_active?: boolean;
  institute_id?: string;
  is_demo?: boolean;
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



export interface FeeSummary {
  totalTarget: number;
  totalCollected: number;
  totalPending: number;
  collectionPercentage: number;
  pendingCount: number;
}

export interface FeeRecord {
  id: string;
  student_id: string;
  student_name?: string;
  batch_name?: string;
  amount: number;
  status: "paid" | "pending" | "partial" | "overdue";
  due_date: string;
  paid_date?: string;
  receipt_no?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  table_name: string;
  record_id?: string;
  created_at: string;
}
