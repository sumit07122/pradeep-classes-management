import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { UserRole } from "../../types";

export interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName?: string;
  pageTitle: string;
  isDemoMode?: boolean;
  onSignOut: () => void;
  onDevRoleChange?: (role: UserRole) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  userRole,
  userName = "Administrator",
  pageTitle,
  onSignOut,
  onDevRoleChange,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pc_sidebar_collapsed") === "true";
    }
    return false;
  });

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 760) {
      setMobileNavOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("pc_sidebar_collapsed", String(next));
        } catch {}
        return next;
      });
    }
  };

  return (
    <div className="app-shell w-full max-w-full overflow-x-hidden min-h-screen relative">
      {/* Sidebar */}
      <Sidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        userRole={userRole}
        userName={userName}
        onSignOut={onSignOut}
        onDevRoleChange={onDevRoleChange}
      />

      {/* Mobile scrim / backdrop */}
      {mobileNavOpen && (
        <div
          className="scrim"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main
        className={`main-area min-w-0 max-w-full overflow-x-hidden flex flex-col min-h-screen ${
          isSidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <Topbar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          pageTitle={pageTitle}
          userRole={userRole}
          userName={userName}
          onSignOut={onSignOut}
        />

        <div className="page-content flex-1 w-full max-w-full min-w-0 overflow-x-hidden">
          {children}
        </div>

        <footer className="footer">
          <span>© 2026 Pradeep Classes</span>
          <span>
            Management Workspace <b>•</b> Production Milestone 1
          </span>
        </footer>
      </main>
    </div>
  );
};
