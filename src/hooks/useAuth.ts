import { useContext } from "react";
import { AuthContext, AuthContextType } from "../context/AuthContext";
import type { UserRole } from "../types";

export function useAuth(): AuthContextType & {
  hasRole: (allowedRoles: UserRole[]) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
  isStaff: boolean;
} {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  const { role } = context;

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    return allowedRoles.includes(role);
  };

  return {
    ...context,
    hasRole,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isTeacher: role === "teacher",
    isStudent: role === "student",
    isParent: role === "parent",
    isStaff: role === "owner" || role === "admin" || role === "teacher",
  };
}
