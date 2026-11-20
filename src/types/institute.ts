export type StudentStatus = "Active" | "Inactive" | "On hold";

export interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  class_name: string;
  batch_name: string;
  batch_id?: string;
  phone: string;
  parent_name?: string;
  parent_phone?: string;
  status: StudentStatus;
  joined_on?: string;
  created_at?: string;
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
  is_demo?: boolean;
}

export interface Batch {
  id: string;
  name: string;
  course_name: string;
  academic_year?: string;
  student_count?: number;
  assigned_teachers?: string[];
  is_active?: boolean;
  is_demo?: boolean;
}

export type AttendanceStatus = "present" | "absent" | "late" | "leave";

export interface AttendanceSession {
  id: string;
  batch_id: string;
  batch_name?: string;
  session_date: string;
  taken_by?: string;
  created_at?: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  student_name?: string;
  status: AttendanceStatus;
  note?: string;
  marked_at: string;
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
