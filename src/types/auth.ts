export type UserRole = "super_admin" | "owner" | "admin" | "teacher" | "student";

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  institute_id?: string;
  created_at?: string;
  is_active?: boolean;
}

export interface AuthSessionState {
  user: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
}

export interface RolePermissions {
  canManageInstitute: boolean;
  canManageStudents: boolean;
  canManageTeachers: boolean;
  canManageBatches: boolean;
  canManageAttendance: boolean;
  canMarkAttendance: boolean;
  canManageFees: boolean;
  canManageExams: boolean;
  canManageHomework: boolean;
  canManageTimetable: boolean;
  canManageAnnouncements: boolean;
  canViewReports: boolean;
  canViewStudentPortal: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  super_admin: {
    canManageInstitute: true,
    canManageStudents: true,
    canManageTeachers: true,
    canManageBatches: true,
    canManageAttendance: true,
    canMarkAttendance: true,
    canManageFees: true,
    canManageExams: true,
    canManageHomework: true,
    canManageTimetable: true,
    canManageAnnouncements: true,
    canViewReports: true,
    canViewStudentPortal: true,
  },
  owner: {
    canManageInstitute: true,
    canManageStudents: true,
    canManageTeachers: true,
    canManageBatches: true,
    canManageAttendance: true,
    canMarkAttendance: true,
    canManageFees: true,
    canManageExams: true,
    canManageHomework: true,
    canManageTimetable: true,
    canManageAnnouncements: true,
    canViewReports: true,
    canViewStudentPortal: false,
  },
  admin: {
    canManageInstitute: false,
    canManageStudents: true,
    canManageTeachers: true,
    canManageBatches: true,
    canManageAttendance: true,
    canMarkAttendance: true,
    canManageFees: true,
    canManageExams: true,
    canManageHomework: true,
    canManageTimetable: true,
    canManageAnnouncements: true,
    canViewReports: true,
    canViewStudentPortal: false,
  },
  teacher: {
    canManageInstitute: false,
    canManageStudents: false,
    canManageTeachers: false,
    canManageBatches: false,
    canManageAttendance: false,
    canMarkAttendance: true,
    canManageFees: false,
    canManageExams: true,
    canManageHomework: true,
    canManageTimetable: false,
    canManageAnnouncements: true,
    canViewReports: false,
    canViewStudentPortal: false,
  },
  student: {
    canManageInstitute: false,
    canManageStudents: false,
    canManageTeachers: false,
    canManageBatches: false,
    canManageAttendance: false,
    canMarkAttendance: false,
    canManageFees: false,
    canManageExams: false,
    canManageHomework: false,
    canManageTimetable: false,
    canManageAnnouncements: false,
    canViewReports: false,
    canViewStudentPortal: true,
  },
};
