import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Input, Button, AlertNotice, Modal } from "../components/common";
import { User, Lock, ShieldCheck, Info, Phone, Building2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
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
      // 1. Try to resolve via universal database resolver RPC
      try {
        if (supabase) {
          const { data: resolvedEmail } = await supabase.rpc("resolve_login_identifier", {
            p_input: authIdentifier,
          });
          if (resolvedEmail && typeof resolvedEmail === "string") {
            authIdentifier = resolvedEmail;
          }
        }
      } catch {
        // Fallback to offline heuristic
      }

      // 2. Client fallback heuristic if RPC did not resolve
      if (!authIdentifier.includes("@")) {
        const lower = authIdentifier.toLowerCase();
        if (lower.startsWith("pc") || /^[0-9]+$/.test(lower)) {
          const digits = lower.replace(/[^0-9]/g, "");
          const padded = digits ? digits.padStart(4, "0") : "0001";
          authIdentifier = `pc-2025-${padded}@student.pradeepclasses.in`;
        } else if (["admin", "owner", "superadmin", "administrator"].includes(lower)) {
          authIdentifier = "admin@pradeepclasses.in";
        } else {
          const cleanName = lower
            .replace(/(^mr\.?\s+|^dr\.?\s+|\s+sir$)/gi, "")
            .trim()
            .replace(/\s+/g, ".");
          authIdentifier = `${cleanName}.sir@faculty.pradeepclasses.in`;
        }
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
              label="Registration Number or Faculty Name"
              type="text"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. PC001, PC-2025-0001, or Avinash Sir"
              icon={<User size={16} />}
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
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[#16466f] font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Forgot password?
              </button>
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
              Students log in via Registration No (e.g. PC001). Faculty via Name (e.g. Avinash Sir).
            </p>
          </div>
        </div>

        {/* Forgot Password Assistance Modal */}
        <Modal
          isOpen={showForgotModal}
          onClose={() => setShowForgotModal(false)}
          title="Account Login & Password Help"
          subtitle="INSTITUTE CREDENTIALS DESK"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
              <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong>Default Coaching Password:</strong>
                <p className="leading-relaxed">
                  Default login password for all students and faculty accounts is:
                </p>
                <div className="font-mono font-extrabold text-xs text-[#102f50] bg-white px-2 py-1 rounded border border-amber-300 inline-block mt-0.5">
                  PRADEEPCLASSES
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <p className="font-bold text-slate-800">Need your password reset or changed?</p>
              <p className="text-slate-600 leading-relaxed">
                For account security, student and teacher credentials are reset directly by the Institute Administration. Please reach out to reception or administration:
              </p>
              <div className="space-y-1.5 pt-1 font-semibold text-slate-800">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-[#16466f]" />
                  <span>Call / WhatsApp: <b>+91 8126180408</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-[#16466f]" />
                  <span>Desk: <b>Pradeep Classes Administrative Office</b></span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="primary" onClick={() => setShowForgotModal(false)}>
                Understood, Close
              </Button>
            </div>
          </div>
        </Modal>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-400">
          <span>© 2026 Pradeep Classes • Authorized personnel only</span>
        </div>
      </div>
    </div>
  );
};
