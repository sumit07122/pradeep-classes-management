export type StudentStatus = "Active" | "Inactive" | "On hold";
export interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  class_name: string;
  batch_name: string;
  phone: string;
  status: StudentStatus;
  created_at?: string;
}
export interface Teacher {
  id: string;
  full_name: string;
  subject: string;
  phone: string;
  assigned_batches: string[];
}
