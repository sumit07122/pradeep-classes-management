import React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: (string | SelectOption)[];
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, className = "", id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-[#536579]">
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full rounded-lg border bg-white text-slate-800 text-xs px-3 py-2 outline-none transition focus:ring-2 focus:ring-offset-1 ${
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
              : "border-[#dfe6ed] focus:border-[#16466f] focus:ring-[#16466f]/20"
          } ${className}`}
          {...props}
        >
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const text = typeof opt === "string" ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {text}
              </option>
            );
          })}
        </select>
        {error && <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>}
        {!error && helperText && <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
