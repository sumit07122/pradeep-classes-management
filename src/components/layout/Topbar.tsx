import React from "react";
import { Menu, CalendarDays, Bell, LogOut } from "lucide-react";
import type { UserRole } from "../../types";

export interface TopbarProps {
  onOpenMobileNav: () => void;
  pageTitle: string;
  userRole: UserRole;
  userName?: string;
  onSignOut: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileNav,
  pageTitle,
  userRole,
  userName = "Administrator",
  onSignOut,
}) => {
  const todayFormatted = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const roleBadgeStyles: Record<UserRole, string> = {
    owner: "bg-amber-100 text-amber-800 border-amber-300",
    admin: "bg-blue-100 text-blue-800 border-blue-300",
    teacher: "bg-emerald-100 text-emerald-800 border-emerald-300",
    student: "bg-purple-100 text-purple-800 border-purple-300",
  };

  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <button
          className="mobile-menu icon-button"
          onClick={onOpenMobileNav}
          aria-label="Open mobile navigation"
        >
          <Menu size={20} />
        </button>
        <div className="breadcrumb">
          Workspace <span>/</span> <b>{pageTitle}</b>
        </div>
      </div>

      <div className="top-actions flex items-center gap-4">
        <div className="today">
          <CalendarDays size={15} />
          <span>{todayFormatted}</span>
        </div>

        <button className="icon-button notification" aria-label="Notifications">
          <Bell size={18} />
          <i />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <span
            className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${roleBadgeStyles[userRole]}`}
          >
            {userRole}
          </span>
          <div className="top-avatar" title={userName}>
            {userName
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <button
            onClick={onSignOut}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition hidden sm:inline-flex"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
