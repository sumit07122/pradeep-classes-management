import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  IndianRupee,
  BookOpen,
  CalendarDays,
  Clock,
  FolderDown,
  Bell,
  FileSpreadsheet,
  Settings,
  TrendingUp,
  Receipt,
  Briefcase,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "../../types";
import { RoleSwitcherDev } from "./RoleSwitcherDev";

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  userRole: UserRole;
  userName?: string;
  onSignOut: () => void;
  onDevRoleChange?: (role: UserRole) => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Platform Admin",
    path: "/platform",
    icon: ShieldCheck,
    roles: ["super_admin"],
  },
  {
    label: "Overview",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "owner", "admin", "accountant", "teacher"],
  },
  {
    label: "Students",
    path: "/students",
    icon: Users,
    roles: ["super_admin", "owner", "admin"],
  },
  {
    label: "Teachers",
    path: "/teachers",
    icon: GraduationCap,
    roles: ["super_admin", "owner", "admin"],
  },
  {
    label: "Batches",
    path: "/batches",
    icon: BookOpen,
    roles: ["super_admin", "owner", "admin", "teacher"],
  },
  {
    label: "Attendance",
    path: "/attendance",
    icon: ClipboardCheck,
    roles: ["super_admin", "owner", "admin", "teacher"],
  },
  {
    label: "Fee Records",
    path: "/fees",
    icon: IndianRupee,
    roles: ["super_admin", "owner", "admin", "accountant"],
  },
  {
    label: "Finance & Analytics",
    path: "/finance",
    icon: TrendingUp,
    roles: ["super_admin", "owner", "admin", "accountant"],
  },
  {
    label: "Expense Ledger",
    path: "/finance/expenses",
    icon: Receipt,
    roles: ["super_admin", "owner", "admin", "accountant"],
  },
  {
    label: "Teacher Payroll",
    path: "/finance/payroll",
    icon: Briefcase,
    roles: ["super_admin", "owner", "admin", "accountant"],
  },
  {
    label: "Exams & Marks",
    path: "/academics",
    icon: CalendarDays,
    roles: ["super_admin", "owner", "admin", "teacher"],
  },
  {
    label: "Class Diary & Syllabus",
    path: "/diary",
    icon: BookOpen,
    roles: ["super_admin", "owner", "admin", "teacher", "student"],
  },
  {
    label: "Timetable",
    path: "/timetable",
    icon: Clock,
    roles: ["super_admin", "owner", "admin", "teacher", "student"],
  },
  {
    label: "Study Materials",
    path: "/materials",
    icon: FolderDown,
    roles: ["super_admin", "owner", "admin", "teacher", "student"],
  },
  {
    label: "Announcements",
    path: "/announcements",
    icon: Bell,
    roles: ["super_admin", "owner", "admin", "teacher", "student"],
  },
  {
    label: "Reports",
    path: "/reports",
    icon: FileSpreadsheet,
    roles: ["super_admin", "owner", "admin", "accountant"],
  },
  {
    label: "Student Portal",
    path: "/portal",
    icon: Users,
    roles: ["student"],
  },
  {
    label: "Settings & Profile",
    path: "/settings",
    icon: Settings,
    roles: ["super_admin", "owner", "admin", "teacher", "student"],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  userRole,
  userName = "Administrator",
  onSignOut,
  onDevRoleChange,
}) => {
  const location = useLocation();

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <aside
      className={`sidebar ${
        isOpen ? "sidebar-open" : ""
      } ${isCollapsed ? "sidebar-collapsed" : ""} flex flex-col justify-between overflow-y-auto`}
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#244565]">
          <Link
            to={
              userRole === "student"
                ? "/portal"
                : userRole === "super_admin"
                ? "/platform"
                : "/dashboard"
            }
            className="brand hover:opacity-95 transition cursor-pointer flex-1"
          >
            <img
              src="/logo.png"
              alt="Pradeep Classes"
              className="w-9 h-9 object-contain rounded-xl bg-white p-0.5 shadow-sm border border-slate-200 shrink-0"
            />
            <div className="overflow-hidden">
              <strong className="truncate">Pradeep Classes</strong>
              <span>INSTITUTE MANAGEMENT</span>
            </div>
          </Link>
          <button
            className="sidebar-close-btn p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#1a4166] transition shrink-0 ml-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggleCollapse && typeof window !== "undefined" && window.innerWidth > 760) {
                onToggleCollapse();
              } else {
                onClose();
              }
            }}
            title="Hide Sidebar"
            aria-label="Hide sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="nav-caption">WORKSPACE ({userRole.toUpperCase()})</div>
        <nav className="space-y-1">
          {allowedNav.map((item) => {
            const isExact = location.pathname === item.path;
            const hasMoreSpecificMatch = allowedNav.some(
              (other) =>
                other.path !== item.path &&
                other.path.startsWith(item.path) &&
                location.pathname.startsWith(other.path)
            );
            const isActive =
              isExact ||
              (!hasMoreSpecificMatch &&
                item.path !== "/dashboard" &&
                item.path !== "/" &&
                location.pathname.startsWith(item.path + "/"));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-bottom pt-4">
        {onDevRoleChange && (
          <RoleSwitcherDev currentRole={userRole} onRoleChange={onDevRoleChange} />
        )}

        <div className="profile mt-4 pt-3 border-t border-[#2d4b67]">
          <div className="profile-avatar">
            {userName
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <b className="truncate">{userName}</b>
            <small className="capitalize text-slate-300 font-medium">{userRole}</small>
          </div>
          <button
            onClick={onSignOut}
            className="ml-auto text-slate-400 hover:text-rose-400 p-1.5 rounded transition"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
