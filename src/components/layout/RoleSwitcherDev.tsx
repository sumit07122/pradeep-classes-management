import React from "react";
import { env } from "../../lib/env";
import type { UserRole } from "../../types";

export interface RoleSwitcherDevProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const RoleSwitcherDev: React.FC<RoleSwitcherDevProps> = ({
  currentRole,
  onRoleChange,
}) => {
  // STRICT SECURITY CHECK: Completely unavailable in production
  if (!import.meta.env.DEV || !env.enableDevRoleSwitch) {
    return null;
  }

  const roles: { role: UserRole; label: string }[] = [
    { role: "owner", label: "Owner" },
    { role: "admin", label: "Admin" },
    { role: "teacher", label: "Teacher" },
    { role: "student", label: "Student" },
    { role: "parent", label: "Parent" },
  ];

  return (
    <div className="mt-4 p-2.5 rounded-lg bg-amber-950/80 border border-amber-600/50 text-[11px] text-amber-200">
      <div className="flex items-center justify-between mb-1.5 font-bold uppercase tracking-wider text-[9px] text-amber-400">
        <span>Dev Role Preview</span>
        <span className="px-1 py-0.5 rounded bg-amber-800 text-[8px] text-white">
          DEV ONLY
        </span>
      </div>
      <p className="text-[10px] text-amber-300/80 mb-2 leading-tight">
        Test UI permissions for different institute roles.
      </p>
      <div className="grid grid-cols-2 gap-1">
        {roles.map(({ role, label }) => (
          <button
            key={role}
            type="button"
            onClick={() => onRoleChange(role)}
            className={`px-2 py-1 rounded text-[10px] font-bold text-left transition ${
              currentRole === role
                ? "bg-amber-400 text-slate-900 shadow-sm"
                : "bg-amber-900/60 hover:bg-amber-800/80 text-amber-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
