import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-bold transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "h-8 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3.5 text-xs gap-2",
    lg: "h-11 px-5 text-sm gap-2.5",
  };

  const variantClasses = {
    primary:
      "bg-[#16466f] hover:bg-[#0f385d] text-white border border-[#16466f] shadow-sm focus:ring-[#16466f]",
    secondary:
      "bg-white hover:bg-slate-50 text-[#52657a] border border-[#dce4ec] focus:ring-slate-300",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 focus:ring-rose-500",
    ghost:
      "bg-transparent hover:bg-slate-100 text-slate-700 border-transparent focus:ring-slate-300",
    outline:
      "bg-transparent hover:bg-[#eaf2fa] text-[#16466f] border border-[#16466f] focus:ring-[#16466f]",
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
