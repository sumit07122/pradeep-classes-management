import React from "react";
import { AlertTriangle } from "lucide-react";

export interface DemoBannerProps {
  onDismiss?: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = () => {
  return (
    <div className="bg-purple-900 text-purple-100 px-4 py-2 text-xs flex items-center justify-between shadow-sm border-b border-purple-800">
      <div className="flex items-center gap-2 font-medium">
        <span className="bg-purple-700 text-white text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded">
          DEMO MODE
        </span>
        <AlertTriangle size={15} className="text-purple-300" />
        <span>
          Running in offline preview with in-memory sample records. These are simulated statistics and not real student data.
        </span>
      </div>
      <span className="text-[11px] text-purple-300 hidden md:inline">
        Configure Supabase credentials in .env.local to persist live records.
      </span>
    </div>
  );
};
