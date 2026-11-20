import React from "react";
import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  delta?: string;
  note?: string;
  icon: LucideIcon;
  tone?: "blue" | "violet" | "green" | "amber";
  isDemo?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  delta,
  note,
  icon: Icon,
  tone = "blue",
  isDemo = false,
}) => {
  const toneClasses = {
    blue: "bg-[#eaf2fa] text-[#376e9f]",
    violet: "bg-[#f0edfb] text-[#7965ba]",
    green: "bg-[#e9f6ef] text-[#39946a]",
    amber: "bg-[#fff5e4] text-[#c18a2e]",
  };

  return (
    <div className="bg-white border border-[#e8edf2] rounded-xl p-4 shadow-sm hover:shadow transition-shadow relative overflow-hidden">
      {isDemo && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700 rounded border border-purple-200">
          Demo
        </span>
      )}
      <div className="flex items-center justify-between text-[#788899] text-xs">
        <span className="font-semibold uppercase tracking-wider text-[10px]">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneClasses[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
      <div className="font-extrabold text-2xl tracking-tight text-[#1c3045] my-2 font-['Manrope']">
        {value}
      </div>
      {(delta || note) && (
        <div className="flex items-center gap-1.5 text-[11px]">
          {delta && <b className="text-emerald-600 font-bold">{delta}</b>}
          {note && <span className="text-[#a0aab5]">{note}</span>}
        </div>
      )}
    </div>
  );
};
