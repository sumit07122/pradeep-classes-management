import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ShieldX, ArrowLeft, LogOut, BookOpen, Clock, FolderDown, Users } from "lucide-react";
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
            {role === "student" ? "Return to Student Portal" : "Return to Authorized Workspace"}
          </Button>

          {role === "student" && (
            <div className="pt-2 pb-1 border-t border-slate-100 mt-2">
              <div className="text-[11px] font-bold text-slate-600 mb-2">Student Authorized Links:</div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <Link
                  to="/portal"
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200 transition"
                >
                  <Users size={14} className="text-[#16466f]" />
                  <span>My Portal</span>
                </Link>
                <Link
                  to="/diary"
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200 transition"
                >
                  <BookOpen size={14} className="text-[#16466f]" />
                  <span>Class Diary</span>
                </Link>
                <Link
                  to="/timetable"
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200 transition"
                >
                  <Clock size={14} className="text-[#16466f]" />
                  <span>Timetable</span>
                </Link>
                <Link
                  to="/materials"
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200 transition"
                >
                  <FolderDown size={14} className="text-[#16466f]" />
                  <span>Materials</span>
                </Link>
              </div>
            </div>
          )}

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
