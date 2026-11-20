import React from "react";
import { AlertOctagon, Terminal } from "lucide-react";
import { Button } from "../components/common";

export const ConfigError: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#102f50] p-4 text-slate-100">
      <div className="max-w-lg w-full bg-[#163a60] rounded-2xl border border-[#2b5480] shadow-2xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-5">
          <AlertOctagon size={32} />
        </div>

        <h1 className="text-2xl font-extrabold font-['Manrope'] text-white tracking-tight">
          Production Database Configuration Required
        </h1>

        <p className="text-xs text-slate-300 leading-relaxed mt-2 mb-6">
          The Pradeep Classes Management System is running in production mode, but the Supabase
          connection credentials have not been configured. In accordance with security protocols,
          the application will not silently fall back to mock data in production.
        </p>

        <div className="bg-[#0c233c] rounded-xl p-4 border border-[#1e446d] mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-2">
            <Terminal size={15} />
            <span>Required Environment Variables</span>
          </div>
          <code className="block text-[11px] font-mono text-slate-300 space-y-1">
            <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
            <div>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...</div>
          </code>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">
            Next steps for administrator:
          </h4>
          <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed text-[11px]">
            <li>Open your Vercel Project Dashboard.</li>
            <li>Go to <b>Settings &gt; Environment Variables</b>.</li>
            <li>Add your Supabase Project URL and Anon/Public Key.</li>
            <li>Trigger a redeployment to apply the configuration.</li>
          </ol>
        </div>

        <div className="mt-8 pt-6 border-t border-[#264b73] flex justify-between items-center">
          <span className="text-[10px] text-slate-400">Pradeep Classes System Guard</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="text-white border-slate-400 hover:bg-[#204a75]"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    </div>
  );
};
