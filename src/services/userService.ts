import type { InstituteUser, CreateUserDTO, ResetPasswordDTO } from "../types/user";
import type { UserRole } from "../types/auth";
import { supabase } from "../lib/supabase";

let mockClient: any = null;

/**
 * For testing purposes: inject a mock Supabase client
 */
export function setSupabaseClient(client: any) {
  mockClient = client;
}

function getClient(): any {
  return mockClient || supabase;
}

/**
 * Fetch all user accounts belonging to the current tenant institute,
 * including any linked student or teacher record metadata.
 */
export async function listInstituteUsers(): Promise<{ data: InstituteUser[]; error?: string }> {
  try {
    const client = await getClient();
    if (!client) {
      return { data: [], error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_list_institute_users");

    if (error) {
      return { data: [], error: error.message };
    }

    const list: InstituteUser[] = (data || []).map((row: any) => {
      const linkedStudent = row.linked_student_id
        ? {
            id: row.linked_student_id,
            full_name: row.linked_student_name || "",
            admission_no: row.linked_admission_no || undefined,
          }
        : null;

      const linkedTeacher = row.linked_teacher_id
        ? {
            id: row.linked_teacher_id,
            full_name: row.linked_teacher_name || "",
          }
        : null;

      return {
        id: row.id,
        email: row.email || "",
        full_name: row.full_name || "",
        role: row.role as UserRole,
        phone: row.phone || null,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        linked_student: linkedStudent,
        linked_teacher: linkedTeacher,
        linked_student_id: row.linked_student_id || null,
        linked_student_name: row.linked_student_name || null,
        linked_admission_no: row.linked_admission_no || null,
        linked_teacher_id: row.linked_teacher_id || null,
        linked_teacher_name: row.linked_teacher_name || null,
      };
    });

    return { data: list };
  } catch (err: any) {
    return { data: [], error: err?.message || "Failed to list users." };
  }
}

/**
 * Provision a new user account with pgcrypto password hashing and optional student/teacher linkage.
 */
export async function createInstituteUser(
  dto: CreateUserDTO
): Promise<{ data: InstituteUser | null; error?: string }> {
  try {
    if (!dto.full_name || !dto.full_name.trim()) {
      return { data: null, error: "Full name is required." };
    }
    if (!dto.password || dto.password.length < 6) {
      return { data: null, error: "Password must be at least 6 characters long." };
    }
    if (!dto.role) {
      return { data: null, error: "User role is required." };
    }
    if (!dto.email?.trim() && !dto.student_id) {
      return { data: null, error: "Email is required when creating a non-student user." };
    }

    const client = await getClient();
    if (!client) {
      return { data: null, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_create_institute_user", {
      p_email: dto.email && dto.email.trim() ? dto.email.trim().toLowerCase() : null,
      p_password: dto.password,
      p_full_name: dto.full_name.trim(),
      p_role: dto.role,
      p_student_id: dto.student_id || null,
      p_teacher_id: dto.teacher_id || null,
      p_phone: dto.phone && dto.phone.trim() ? dto.phone.trim() : null,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: "No response from user creation RPC." };
    }

    if (typeof data === "object" && data.status === "error") {
      return { data: null, error: data.message || "Failed to create user." };
    }

    const linkedStudent = data.linked_student_id
      ? {
          id: data.linked_student_id,
          full_name: data.linked_student_name || dto.full_name,
          admission_no: data.linked_admission_no || undefined,
        }
      : null;

    const linkedTeacher = data.linked_teacher_id
      ? {
          id: data.linked_teacher_id,
          full_name: data.linked_teacher_name || dto.full_name,
        }
      : null;

    const newUser: InstituteUser = {
      id: data.id,
      email: data.email || "",
      full_name: data.full_name || dto.full_name,
      role: data.role as UserRole,
      phone: data.phone || null,
      is_active: data.is_active ?? true,
      created_at: data.created_at || new Date().toISOString(),
      linked_student: linkedStudent,
      linked_teacher: linkedTeacher,
      linked_student_id: data.linked_student_id || null,
      linked_student_name: data.linked_student_name || (data.linked_student_id ? dto.full_name : null),
      linked_admission_no: data.linked_admission_no || null,
      linked_teacher_id: data.linked_teacher_id || null,
      linked_teacher_name: data.linked_teacher_name || (data.linked_teacher_id ? dto.full_name : null),
    };

    return { data: newUser };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to create user." };
  }
}

/**
 * Administratively reset an existing user's password.
 */
export async function resetUserPassword(
  dto: ResetPasswordDTO
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = dto.userId || dto.user_id;
    const newPassword = dto.newPassword || dto.new_password;

    if (!userId) {
      return { success: false, error: "User ID is required." };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_reset_user_password", {
      p_user_id: userId,
      p_new_password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.status === "error") {
      return { success: false, error: data.message || "Failed to reset password." };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to reset password." };
  }
}

/**
 * Toggle active status of a user (deactivate / reactivate login capabilities).
 */
export async function toggleUserStatus(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required." };
    }

    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_toggle_user_status", {
      p_user_id: userId,
      p_is_active: Boolean(isActive),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.status === "error") {
      return { success: false, error: data.message || "Failed to toggle user status." };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to toggle user status." };
  }
}

/**
 * Permanently delete or unlink a user account.
 * Calls RPC admin_delete_institute_user.
 */
export async function deleteInstituteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required." };
    }

    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_delete_institute_user", {
      p_user_id: userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.status === "error") {
      return { success: false, error: data.message || "Failed to delete user." };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete user." };
  }
}

/**
 * Administratively update a user's login username / registration handle.
 * Calls RPC admin_update_user_username which handles auth.users, auth.identities,
 * students.admission_no, and audit_logs synchronization.
 */
export async function updateUserUsername(
  userId: string,
  newUsername: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required." };
    }
    if (!newUsername || !newUsername.trim()) {
      return { success: false, error: "New username cannot be empty." };
    }

    const client = await getClient();
    if (!client) {
      return { success: false, error: "Supabase client is not configured." };
    }

    const { data, error } = await client.rpc("admin_update_user_username", {
      p_user_id: userId,
      p_new_username: newUsername.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && data.status === "error") {
      return { success: false, error: data.message || "Failed to update username." };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update username." };
  }
}

export const userService = {
  listInstituteUsers,
  createInstituteUser,
  resetUserPassword,
  toggleUserStatus,
  deleteInstituteUser,
  updateUserUsername,
};
