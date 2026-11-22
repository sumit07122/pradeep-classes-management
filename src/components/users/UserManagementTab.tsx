import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  GraduationCap,
  Briefcase,
  Eye,
  EyeOff,
  Sparkles,
  Phone,
  Mail,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { Button, Input, Badge, LoadingSpinner, AlertNotice, Modal } from "../common";
import { userService } from "../../services/userService";
import { studentsService } from "../../services/studentsService";
import { teachersService } from "../../services/teachersService";
import type { InstituteUser, CreateUserDTO } from "../../types/user";
import type { UserRole } from "../../types/auth";

export interface UserManagementTabProps {
  initialUsers?: InstituteUser[];
}

/**
 * Generate a strong, secure random password containing uppercase,
 * lowercase, numbers, and symbols.
 */
export function generateSecurePassword(length = 10): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + numbers + symbols;

  // Guarantee at least one character from each set
  const guaranteed = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const remaining: string[] = [];
  for (let i = 0; i < Math.max(0, length - 4); i++) {
    remaining.push(all[Math.floor(Math.random() * all.length)]);
  }

  return [...guaranteed, ...remaining]
    .sort(() => 0.5 - Math.random())
    .join("");
}

/**
 * Clean phone number and construct a WhatsApp direct messaging URL.
 * Automatically adds the 91 country code prefix if 10 digits are supplied.
 */
export function formatWhatsAppUrl(phone: string, text: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const cleanPhone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Build formatted credentials notification text for clipboard and WhatsApp dispatch.
 */
export function buildCredentialsMessage(params: {
  name: string;
  username: string;
  password: string;
  portalUrl: string;
  isReset?: boolean;
}): string {
  if (params.isReset) {
    return `*Pradeep Classes - Password Reset*

Hello ${params.name},
Your login password for the Pradeep Classes Portal has been successfully updated:

*Portal URL:* ${params.portalUrl}
*Username / Email:* ${params.username}
*New Password:* ${params.password}

Please log in and keep your password secure. Do not share your login credentials with anyone.`;
  }

  return `*Pradeep Classes - Account Credentials*

Hello ${params.name},
Your login credentials for the Pradeep Classes Portal have been set up:

*Portal URL:* ${params.portalUrl}
*Username / Email:* ${params.username}
*Password:* ${params.password}

Please log in and update your password if desired. Do not share your login credentials with anyone.`;
}

/**
 * Filter users by role pill and search keyword across name, email, phone, and linked records.
 */
export function filterUsers(
  users: InstituteUser[],
  roleFilter: string,
  searchQuery: string
): InstituteUser[] {
  let filtered = [...users];

  // Role pill filter
  const rf = roleFilter.toLowerCase();
  if (rf === "teachers") {
    filtered = filtered.filter((u) => u.role === "teacher");
  } else if (rf === "students") {
    filtered = filtered.filter((u) => u.role === "student");
  } else if (rf === "admins") {
    filtered = filtered.filter((u) =>
      ["admin", "owner", "super_admin"].includes(u.role)
    );
  }

  // Search keyword filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      const studentName = (
        u.linked_student_name ||
        u.linked_student?.full_name ||
        ""
      ).toLowerCase();
      const teacherName = (
        u.linked_teacher_name ||
        u.linked_teacher?.full_name ||
        ""
      ).toLowerCase();
      const admissionNo = (
        u.linked_admission_no ||
        u.linked_student?.admission_no ||
        ""
      ).toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        studentName.includes(q) ||
        teacherName.includes(q) ||
        admissionNo.includes(q)
      );
    });
  }

  return filtered;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  initialUsers,
}) => {
  const [users, setUsers] = useState<InstituteUser[]>(initialUsers || []);
  const [loading, setLoading] = useState<boolean>(!initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "teachers" | "students" | "admins">("all");
  const [alertNotice, setAlertNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Linkable records for dropdowns
  const [availableStudents, setAvailableStudents] = useState<
    Array<{ id: string; full_name: string; admission_no?: string; phone?: string; parent_phone?: string; email?: string }>
  >([]);
  const [availableTeachers, setAvailableTeachers] = useState<
    Array<{ id: string; full_name: string; subject?: string; phone?: string; email?: string }>
  >([]);

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createRole, setCreateRole] = useState<UserRole>("student");
  const [createFullName, setCreateFullName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(true);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<InstituteUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(true);
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Credentials Summary Popup
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    password: string;
    phone?: string;
    role: string;
    isReset?: boolean;
  } | null>(null);
  const [copiedState, setCopiedState] = useState(false);

  // Toggling status state
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Load users from service if not initially provided
  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await userService.listInstituteUsers();
      if (res.error) {
        setAlertNotice({ type: "error", message: res.error });
      } else {
        setUsers(res.data || []);
      }
    } catch (err: any) {
      setAlertNotice({
        type: "error",
        message: err?.message || "Failed to load user accounts.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load linkable students and teachers for creation modal
  const loadLinkables = async () => {
    try {
      const [studentsRes, teachersRes] = await Promise.all([
        studentsService.getStudents({ pageSize: 300 }),
        teachersService.getTeachers(),
      ]);

      if (studentsRes?.data) {
        setAvailableStudents(
          studentsRes.data.map((s) => ({
            id: s.id,
            full_name: s.full_name,
            admission_no: s.admission_no,
            phone: s.phone || s.parent_phone,
            parent_phone: s.parent_phone,
            email: s.email,
          }))
        );
      }

      if (teachersRes?.data) {
        setAvailableTeachers(
          teachersRes.data.map((t) => ({
            id: t.id,
            full_name: t.full_name,
            subject: t.subject,
            phone: t.phone,
            email: (t as any).email || "",
          }))
        );
      }
    } catch {
      // Non-blocking if offline/demo
    }
  };

  useEffect(() => {
    if (!initialUsers) {
      loadUsers();
    }
    loadLinkables();
  }, []);

  const portalUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/login`;
    }
    return "https://pradeepclasses.in/login";
  }, []);

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return filterUsers(users, roleFilter, searchQuery);
  }, [users, roleFilter, searchQuery]);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: users.length,
      teachers: users.filter((u) => u.role === "teacher").length,
      students: users.filter((u) => u.role === "student").length,
      admins: users.filter((u) =>
        ["admin", "owner", "super_admin"].includes(u.role)
      ).length,
    };
  }, [users]);

  // Handle open create user modal
  const handleOpenCreateModal = () => {
    setCreateRole("student");
    setCreateFullName("");
    setCreateEmail("");
    setCreatePassword(generateSecurePassword(10));
    setCreatePhone("");
    setSelectedStudentId("");
    setSelectedTeacherId("");
    setShowCreatePassword(true);
    setCreateModalError(null);
    setIsCreateModalOpen(true);
  };

  // When student selection changes in modal
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (!studentId) return;

    const student = availableStudents.find((s) => s.id === studentId);
    if (student) {
      if (!createFullName || createFullName === "") {
        setCreateFullName(student.full_name);
      }
      if (!createPhone && student.phone) {
        setCreatePhone(student.phone);
      }
      if (student.email) {
        setCreateEmail(student.email);
      } else if (student.admission_no) {
        // Suggested email format based on admission number
        const cleanAdm = student.admission_no.toLowerCase().replace(/[^a-z0-9]/g, "");
        setCreateEmail(`${cleanAdm}@pradeepclasses.in`);
      }
    }
  };

  // When teacher selection changes in modal
  const handleSelectTeacher = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    if (!teacherId) return;

    const teacher = availableTeachers.find((t) => t.id === teacherId);
    if (teacher) {
      if (!createFullName || createFullName === "") {
        setCreateFullName(teacher.full_name);
      }
      if (!createPhone && teacher.phone) {
        setCreatePhone(teacher.phone);
      }
      if (teacher.email) {
        setCreateEmail(teacher.email);
      }
    }
  };

  // Submit Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);

    if (!createFullName.trim()) {
      setCreateModalError("Please provide a full name for the user.");
      return;
    }
    if (!createPassword || createPassword.length < 6) {
      setCreateModalError("Password must be at least 6 characters long.");
      return;
    }
    if (createRole !== "student" && !createEmail.trim()) {
      setCreateModalError("Email is required for staff, teacher, and admin accounts.");
      return;
    }

    setIsCreatingUser(true);

    try {
      const dto: CreateUserDTO = {
        role: createRole,
        full_name: createFullName.trim(),
        email: createEmail.trim() || undefined,
        password: createPassword,
        phone: createPhone.trim() || undefined,
        student_id: createRole === "student" && selectedStudentId ? selectedStudentId : undefined,
        teacher_id: createRole === "teacher" && selectedTeacherId ? selectedTeacherId : undefined,
      };

      const res = await userService.createInstituteUser(dto);

      if (res.error) {
        setCreateModalError(res.error);
        setIsCreatingUser(false);
        return;
      }

      const created = res.data;
      if (created) {
        setUsers((prev) => [created, ...prev]);
        setIsCreateModalOpen(false);

        // Open Credentials Summary Modal
        setCreatedCredentials({
          name: created.full_name,
          username: created.email,
          password: createPassword,
          phone: created.phone || createPhone || undefined,
          role: created.role,
          isReset: false,
        });

        setAlertNotice({
          type: "success",
          message: `User account for ${created.full_name} (${created.email}) created successfully!`,
        });
      }
    } catch (err: any) {
      setCreateModalError(err?.message || "Failed to create user account.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetModal = (user: InstituteUser) => {
    setResetTargetUser(user);
    setResetPasswordValue(generateSecurePassword(10));
    setShowResetPassword(true);
    setResetModalError(null);
  };

  // Submit Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetModalError(null);

    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      setResetModalError("Password must be at least 6 characters long.");
      return;
    }

    setIsResettingPassword(true);

    try {
      const res = await userService.resetUserPassword({
        userId: resetTargetUser.id,
        newPassword: resetPasswordValue,
      });

      if (res.error) {
        setResetModalError(res.error);
        setIsResettingPassword(false);
        return;
      }

      const target = resetTargetUser;
      setResetTargetUser(null);

      // Open Credentials Summary modal for sharing
      setCreatedCredentials({
        name: target.full_name,
        username: target.email,
        password: resetPasswordValue,
        phone: target.phone || undefined,
        role: target.role,
        isReset: true,
      });

      setAlertNotice({
        type: "success",
        message: `Password reset successfully for ${target.full_name}!`,
      });
    } catch (err: any) {
      setResetModalError(err?.message || "Failed to reset password.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Toggle User Status (Deactivate / Reactivate)
  const handleToggleStatus = async (user: InstituteUser) => {
    const newStatus = !user.is_active;
    const actionLabel = newStatus ? "activate" : "deactivate";

    setTogglingUserId(user.id);
    try {
      const res = await userService.toggleUserStatus(user.id, newStatus);
      if (res.error) {
        setAlertNotice({ type: "error", message: res.error });
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
        );
        setAlertNotice({
          type: "success",
          message: `User ${user.full_name} has been ${newStatus ? "activated" : "deactivated"} successfully.`,
        });
      }
    } catch (err: any) {
      setAlertNotice({
        type: "error",
        message: err?.message || `Failed to ${actionLabel} user.`,
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  // Copy full credentials to clipboard
  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;
    const msg = buildCredentialsMessage({
      name: createdCredentials.name,
      username: createdCredentials.username,
      password: createdCredentials.password,
      portalUrl,
      isReset: createdCredentials.isReset,
    });

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg);
      }
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2500);
    } catch {
      // Fallback
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "student":
        return "info";
      case "teacher":
        return "warning";
      case "admin":
        return "violet";
      case "owner":
        return "amber";
      case "super_admin":
        return "violet";
      default:
        return "neutral";
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notice */}
      {alertNotice && (
        <AlertNotice
          type={alertNotice.type}
          message={alertNotice.message}
          onDismiss={() => setAlertNotice(null)}
        />
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#16466f] flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1c3045] tracking-tight">
                User Accounts & Access Management
              </h2>
              <p className="text-xs text-slate-500">
                Provision logins, reset credentials, and dispatch WhatsApp access links to students, teachers, and staff.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadUsers}
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            disabled={loading}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={<UserPlus size={15} />}
          >
            Create New User
          </Button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Role Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setRoleFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              roleFilter === "all"
                ? "bg-[#16466f] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>All</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                roleFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setRoleFilter("teachers")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              roleFilter === "teachers"
                ? "bg-[#16466f] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Briefcase size={12} />
            <span>Teachers</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                roleFilter === "teachers" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {counts.teachers}
            </span>
          </button>

          <button
            onClick={() => setRoleFilter("students")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              roleFilter === "students"
                ? "bg-[#16466f] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <GraduationCap size={13} />
            <span>Students</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                roleFilter === "students" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {counts.students}
            </span>
          </button>

          <button
            onClick={() => setRoleFilter("admins")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              roleFilter === "admins"
                ? "bg-[#16466f] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Shield size={12} />
            <span>Admins</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                roleFilter === "admins" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {counts.admins}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, admission #..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f] text-slate-800"
          />
        </div>
      </div>

      {/* User Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Loading institute user accounts..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Users size={24} />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">No User Accounts Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || roleFilter !== "all"
                ? "No user accounts match the current filter and search query."
                : "No accounts have been provisioned yet. Click Create New User to get started."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenCreateModal}
              icon={<UserPlus size={14} />}
            >
              Create New User
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email / Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Linked Record</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const initials = u.full_name
                    ? u.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "U";

                  const linkedStudentName =
                    u.linked_student_name || u.linked_student?.full_name;
                  const linkedAdmNo =
                    u.linked_admission_no || u.linked_student?.admission_no;
                  const linkedTeacherName =
                    u.linked_teacher_name || u.linked_teacher?.full_name;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 transition group text-slate-700"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-[#16466f] flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{u.full_name}</div>
                            {u.phone && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone size={10} className="text-slate-400" />
                                <span>{u.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email / Username */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={u.email}>
                            {u.email}
                          </span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                          {u.role.replace("_", " ")}
                        </Badge>
                      </td>

                      {/* Linked Record */}
                      <td className="py-3.5 px-4">
                        {linkedStudentName ? (
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <GraduationCap size={14} className="text-sky-600 shrink-0" />
                            <span className="font-semibold">{linkedStudentName}</span>
                            {linkedAdmNo && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({linkedAdmNo})
                              </span>
                            )}
                          </div>
                        ) : linkedTeacherName ? (
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Briefcase size={13} className="text-amber-600 shrink-0" />
                            <span className="font-semibold">{linkedTeacherName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            — Direct Account
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant={u.is_active ? "success" : "neutral"}
                          size="sm"
                          showDot
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleOpenResetModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs"
                            title="Reset password and dispatch credentials"
                          >
                            <KeyRound size={12} className="text-amber-600" />
                            <span>Reset Password</span>
                          </button>

                          {/* Toggle Active / Deactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={togglingUserId === u.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition shadow-xs ${
                              u.is_active
                                ? "border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100/60"
                                : "border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/60"
                            }`}
                            title={u.is_active ? "Deactivate user login" : "Activate user login"}
                          >
                            {u.is_active ? (
                              <>
                                <ShieldAlert size={12} />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={12} />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create New User */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New User Account"
        subtitle="ADMINISTRATIVE PROVISIONING"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-4">
          {createModalError && (
            <AlertNotice
              type="error"
              message={createModalError}
              onDismiss={() => setCreateModalError(null)}
            />
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Account Role <span className="text-rose-500">*</span>
            </label>
            <select
              value={createRole}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setCreateRole(newRole);
                setSelectedStudentId("");
                setSelectedTeacherId("");
              }}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
            >
              <option value="student">Student (Portal Access)</option>
              <option value="teacher">Teacher (Faculty Portal & Diary)</option>
              <option value="admin">Admin (Branch Administrator)</option>
              <option value="owner">Owner (Full Management)</option>
            </select>
          </div>

          {/* Link to existing student if role === student */}
          {createRole === "student" && availableStudents.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Link to Registered Student (Optional)
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => handleSelectStudent(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
              >
                <option value="">-- Direct Student Account (Not Linked) --</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.admission_no ? `(${s.admission_no})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Linking auto-populates the student's name, phone, and admission ID login email.
              </p>
            </div>
          )}

          {/* Link to existing teacher if role === teacher */}
          {createRole === "teacher" && availableTeachers.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Link to Registered Teacher (Optional)
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleSelectTeacher(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
              >
                <option value="">-- Direct Teacher Account (Not Linked) --</option>
                {availableTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} {t.subject ? `(${t.subject})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Full Name */}
          <Input
            label="Full Name"
            required
            value={createFullName}
            onChange={(e) => setCreateFullName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
          />

          {/* Email / Username */}
          <div>
            <Input
              label={
                createRole === "student"
                  ? "Email / Login Username (Optional for Students)"
                  : "Email Address (Login Username)"
              }
              required={createRole !== "student"}
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder={
                createRole === "student"
                  ? "Optional: defaults to admission_no@pradeepclasses.in"
                  : "user@pradeepclasses.in"
              }
            />
            {createRole === "student" && !createEmail && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                If omitted, an email based on the student's admission number will be automatically generated.
              </p>
            )}
          </div>

          {/* Phone Number */}
          <Input
            label="Phone Number (for WhatsApp Credential Sharing)"
            type="tel"
            value={createPhone}
            onChange={(e) => setCreatePhone(e.target.value)}
            placeholder="e.g. 9876543210"
          />

          {/* Password with Generator Button */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Temporary Password <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
                  placeholder="Min 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCreatePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCreatePassword(generateSecurePassword(10))}
                icon={<Sparkles size={13} className="text-amber-500" />}
                title="Generate Secure Password"
              >
                Auto-Generate
              </Button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isCreatingUser}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Reset Password Modal */}
      <Modal
        isOpen={Boolean(resetTargetUser)}
        onClose={() => setResetTargetUser(null)}
        title="Reset User Password"
        subtitle={
          resetTargetUser
            ? `USER: ${resetTargetUser.full_name} (${resetTargetUser.email})`
            : "SECURITY CREDENTIAL RESET"
        }
        maxWidth="md"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          {resetModalError && (
            <AlertNotice
              type="error"
              message={resetModalError}
              onDismiss={() => setResetModalError(null)}
            />
          )}

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Resetting account login password</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                The new password will be encrypted in the database. You will be able to copy or dispatch it via WhatsApp immediately after saving.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#16466f]"
                  placeholder="Min 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setResetPasswordValue(generateSecurePassword(10))}
                icon={<Sparkles size={13} className="text-amber-500" />}
              >
                Auto-Generate
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetTargetUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isResettingPassword}
              icon={<KeyRound size={14} />}
            >
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Credentials Summary & WhatsApp Dispatch */}
      <Modal
        isOpen={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        title={
          createdCredentials?.isReset
            ? "Password Updated Successfully"
            : "User Account Provisioned"
        }
        subtitle="CREDENTIAL DISPATCH HUB"
        maxWidth="md"
      >
        {createdCredentials && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span>
                {createdCredentials.isReset
                  ? "The password has been securely updated."
                  : "The user account is now active and ready for login."}
              </span>
            </div>

            {/* Credentials Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-sans">
                <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  Account Details
                </span>
                <Badge variant={getRoleBadgeVariant(createdCredentials.role as UserRole)} size="sm">
                  {createdCredentials.role}
                </Badge>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block font-sans">Full Name:</span>
                <span className="font-bold text-slate-800 text-sm font-sans">
                  {createdCredentials.name}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block font-sans">Portal URL:</span>
                <span className="font-semibold text-[#16466f] select-all break-all">
                  {portalUrl}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block font-sans">Username / Email:</span>
                <span className="font-bold text-slate-900 select-all break-all">
                  {createdCredentials.username}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block font-sans">Password:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 select-all inline-block">
                  {createdCredentials.password}
                </span>
              </div>

              {createdCredentials.phone && (
                <div>
                  <span className="text-[11px] text-slate-500 block font-sans">Phone Number:</span>
                  <span className="text-slate-800">{createdCredentials.phone}</span>
                </div>
              )}
            </div>

            {/* Dispatch Action Buttons */}
            <div className="space-y-2 pt-2">
              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="w-full h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
              >
                {copiedState ? (
                  <>
                    <Check size={16} className="text-emerald-600" />
                    <span className="text-emerald-700">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} className="text-slate-500" />
                    <span>Copy Credentials to Clipboard</span>
                  </>
                )}
              </button>

              {/* WhatsApp Share Button */}
              {createdCredentials.phone ? (
                <a
                  href={formatWhatsAppUrl(
                    createdCredentials.phone,
                    buildCredentialsMessage({
                      name: createdCredentials.name,
                      username: createdCredentials.username,
                      password: createdCredentials.password,
                      portalUrl,
                      isReset: createdCredentials.isReset,
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <MessageCircle size={16} />
                  <span>Send via WhatsApp ({createdCredentials.phone})</span>
                  <ExternalLink size={13} className="opacity-75" />
                </a>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500 text-xs text-center">
                  <span>No phone number registered for WhatsApp delivery. You can copy the credentials above.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="primary"
                onClick={() => setCreatedCredentials(null)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
