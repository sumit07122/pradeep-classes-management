export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface AttendanceSession {
  id: string;
  batch_id: string;
  session_date: string;
  taken_by: string | null;
  institute_id: string;
  created_at: string;
  taken_by_name?: string;
  batch_name?: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
  marked_at: string;
  institute_id: string;
}

export interface RollCallStudent {
  student_id: string;
  full_name: string;
  admission_no: string;
  roll_no?: string;
  status: AttendanceStatus;
  note?: string;
  record_id?: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_relation?: string;
}

export interface AttendanceSummary {
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  attendance_rate: number;
}

export interface StudentAttendanceStats {
  student_id: string;
  total_sessions: number;
  attended_sessions: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  percentage: number;
  is_defaulter: boolean;
}

export interface BatchDefaulter {
  student_id: string;
  full_name: string;
  admission_no: string;
  phone: string | null;
  parent_phone: string | null;
  total_sessions: number;
  attended_sessions: number;
  absent_count: number;
  attendance_percentage: number;
}

export interface AttendanceDefaulter {
  student_id: string;
  student_name: string;
  admission_no: string;
  batch_name: string;
  attended_sessions?: number;
  total_sessions?: number;
  percentage: number;
  is_defaulter?: boolean;
}

export interface SaveAttendancePayload {
  batch_id: string;
  session_date: string;
  records: {
    student_id: string;
    status: AttendanceStatus;
    note?: string;
  }[];
}
