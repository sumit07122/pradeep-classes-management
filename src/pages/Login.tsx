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

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    clearError();
    const result = await signIn(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#f0f4f9] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#f4b942] text-[#123251] rounded-2xl mx-auto flex items-center justify-center font-extrabold text-2xl font-['Manrope'] shadow-md mb-3">
            PC
          </div>
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
              label="Email address"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@pradeepclasses.in"
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
