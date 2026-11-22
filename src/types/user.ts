import type { UserRole } from "./auth";

export interface LinkedStudentInfo {
  id: string;
  full_name: string;
  admission_no?: string;
}

export interface LinkedTeacherInfo {
  id: string;
  full_name: string;
}

export interface InstituteUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
  linked_student?: LinkedStudentInfo | null;
  linked_teacher?: LinkedTeacherInfo | null;
  linked_student_id?: string | null;
  linked_student_name?: string | null;
  linked_admission_no?: string | null;
  linked_teacher_id?: string | null;
  linked_teacher_name?: string | null;
}

export interface CreateUserDTO {
  email?: string;
  password: string;
  full_name: string;
  role: UserRole;
  student_id?: string;
  teacher_id?: string;
  phone?: string;
}

export type ResetPasswordDTO =
  | { userId: string; newPassword: string; user_id?: string; new_password?: string }
  | { user_id: string; new_password: string; userId?: string; newPassword?: string };
