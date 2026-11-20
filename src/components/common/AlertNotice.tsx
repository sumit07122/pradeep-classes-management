import React from "react";
import { AlertCircle, CheckCircle2, Info, XCircle, X } from "lucide-react";

export type AlertType = "info" | "success" | "warning" | "error";

export interface AlertNoticeProps {
  type?: AlertType;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export const AlertNotice: React.FC<AlertNoticeProps> = ({
  type = "info",
  title,
  message,
  onDismiss,
  className = "",
}) => {
  const styles = {
    info: {
      bg: "bg-sky-50 border-sky-200 text-sky-800",
      icon: <Info size={17} className="text-sky-600 shrink-0" />,
    },
    success: {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />,
    },
    warning: {
      bg: "bg-amber-50 border-amber-200 text-amber-800",
      icon: <AlertCircle size={17} className="text-amber-600 shrink-0" />,
    },
    error: {
      bg: "bg-rose-50 border-rose-200 text-rose-800",
      icon: <XCircle size={17} className="text-rose-600 shrink-0" />,
    },
  };

  const current = styles[type];

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-lg border text-xs ${current.bg} ${className}`}
      role="alert"
    >
      {current.icon}
      <div className="flex-1">
        {title && <strong className="block font-bold mb-0.5">{title}</strong>}
        <p className="leading-relaxed m-0">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:opacity-75 transition-opacity ml-auto"
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
