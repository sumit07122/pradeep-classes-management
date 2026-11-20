import React from "react";
import { Loader2 } from "lucide-react";

export interface LoadingSpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = "Loading...",
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-slate-500 gap-3 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-[#16466f]`} />
      {label && <span className="text-xs font-semibold">{label}</span>}
    </div>
  );
};
