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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
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
      <main className="main-area flex-1 flex flex-col min-h-screen">
        <Topbar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          pageTitle={pageTitle}
          userRole={userRole}
          userName={userName}
          onSignOut={onSignOut}
        />

        <div className="page-content flex-1">{children}</div>

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
