import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Input, Button, AlertNotice } from "../components/common";
import { Mail, Lock, ShieldCheck } from "lucide-react";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    from?: { pathname?: string } | string;
    unauthorized?: boolean;
    requiredRoles?: string[];
    currentRole?: string;
  } | null;

  const isUnauthorized = Boolean(state?.unauthorized);
  const currentRole = state?.currentRole || "user";
  const requiredRoles = state?.requiredRoles || [];
  const requiredRolesText =
    requiredRoles.length > 0 ? requiredRoles.join(" or ") : "authorized";

  const from =
    typeof state?.from === "string"
      ? state.from
      : state?.from?.pathname || "/dashboard";

  const handleReturnToWorkspace = () => {
    if (currentRole === "student") {
      navigate("/portal", { replace: true });
    } else if (currentRole === "super_admin") {
      navigate("/platform", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    clearError();

    let authIdentifier = email.trim();
    if (!authIdentifier.includes("@")) {
      const lower = authIdentifier.toLowerCase();
      if (lower.startsWith("pc") || /^[0-9]+$/.test(lower)) {
        // Normalize student registration number (e.g. PC-2025-0001 -> pc-2025-0001@student.pradeepclasses.in)
        authIdentifier = `${lower}@student.pradeepclasses.in`;
      } else {
        // Normalize faculty username (e.g. avinash.sir -> avinash.sir@faculty.pradeepclasses.in)
        authIdentifier = `${lower}@faculty.pradeepclasses.in`;
      }
    }

    const result = await signIn(authIdentifier, password);
    setIsSubmitting(false);

    if (result.success) {
      const userRole = (result as any).role || (authIdentifier.toLowerCase().includes("student") ? "student" : "admin");
      let destination = from;

      if (userRole === "student") {
        // Students are restricted to /portal and /settings
        destination = (from && (from.startsWith("/portal") || from.startsWith("/settings"))) ? from : "/portal";
      } else if (userRole === "super_admin") {
        destination = (from && !from.includes("login") && from !== "/") ? from : "/platform";
      } else {
        // Owner, Admin, Teacher
        destination = (from && from !== "/" && from !== "/unauthorized" && from !== "/login") ? from : "/dashboard";
      }

      navigate(destination, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#f0f4f9] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Pradeep Classes"
            className="w-20 h-20 object-contain mx-auto mb-3 bg-white rounded-2xl p-1 shadow-md border border-slate-200"
          />
          <h1 className="text-2xl font-extrabold text-[#102f50] font-['Manrope'] tracking-tight">
            Pradeep Classes
          </h1>
          <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mt-1">
            Institute Management Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xl shadow-slate-200/50">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your credentials to access your academic dashboard.
            </p>
          </div>

          {isUnauthorized && (
            <div className="mb-5 space-y-3">
              <AlertNotice
                type="warning"
                message={`Access Restricted: You are currently signed in as '${currentRole}'. That section requires ${requiredRolesText} clearance.`}
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-full justify-center"
                onClick={handleReturnToWorkspace}
              >
                ← Return to Authorized Workspace
              </Button>
            </div>
          )}

          {authError && (
            <AlertNotice
              type="error"
              message={authError}
              onDismiss={clearError}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Registration Number or Email"
              type="text"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. PC-2025-0001 or admin@pradeepclasses.in"
              icon={<Mail size={16} />}
            />

            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock size={16} />}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-[#16466f] focus:ring-[#16466f]"
                />
                <span>Remember me</span>
              </label>
              <span className="text-[#16466f] font-semibold cursor-pointer hover:underline">
                Forgot password?
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
              icon={<ShieldCheck size={18} />}
            >
              Sign in securely
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500">
              Protected by Role-Based Access Control and Row Level Security.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-400">
          <span>© 2026 Pradeep Classes • Authorized personnel only</span>
        </div>
      </div>
    </div>
  );
};
