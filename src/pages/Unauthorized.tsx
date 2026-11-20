import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ShieldX, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "../components/common";

export const Unauthorized: React.FC = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleReturnHome = () => {
    if (role === "student") {
      navigate("/portal");
    } else if (role === "super_admin") {
      navigate("/platform");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-5">
          <ShieldX size={34} />
        </div>

        <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
          403 Access Denied
        </span>

        <h1 className="text-xl font-extrabold text-[#1c3045] font-['Manrope'] mt-4 mb-2">
          Insufficient Permissions
        </h1>

        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          Your current account role (
          <b className="capitalize text-slate-700">{role}</b>) does not have
          authorization to access this resource or administrative module.
        </p>

        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={handleReturnHome}
            icon={<ArrowLeft size={16} />}
            className="w-full"
          >
            Return to Authorized Workspace
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={signOut}
            icon={<LogOut size={16} />}
            className="w-full"
          >
            Sign in as Different User
          </Button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          If you believe this is an error, please contact the institute owner or administrator.
        </div>
      </div>
    </div>
  );
};
