export type UserRole = "owner" | "admin" | "teacher" | "student" | "parent";

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: UserRole;
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
  canViewAcademics: boolean;
  canViewStudentPortal: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    canManageInstitute: true,
    canManageStudents: true,
    canManageTeachers: true,
    canManageBatches: true,
    canManageAttendance: true,
    canMarkAttendance: true,
    canManageFees: true,
    canViewAcademics: true,
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
    canViewAcademics: true,
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
    canViewAcademics: true,
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
    canViewAcademics: true,
    canViewStudentPortal: true,
  },
  parent: {
    canManageInstitute: false,
    canManageStudents: false,
    canManageTeachers: false,
    canManageBatches: false,
    canManageAttendance: false,
    canMarkAttendance: false,
    canManageFees: false,
    canViewAcademics: true,
    canViewStudentPortal: true,
  },
};
