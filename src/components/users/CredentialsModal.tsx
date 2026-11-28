import React, { useState, useMemo } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Modal, Button, Badge } from "../common";
import { formatWhatsAppUrl, buildCredentialsMessage } from "./UserManagementTab";

export interface CredentialsInfo {
  name: string;
  username: string;
  password: string;
  phone?: string;
  role: string;
  isReset?: boolean;
  portalUrl?: string;
}

export interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: CredentialsInfo | null;
  whatsAppButtonLabel?: string;
  title?: string;
  subtitle?: string;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  isOpen,
  onClose,
  credentials,
  whatsAppButtonLabel,
  title,
  subtitle = "CREDENTIAL DISPATCH HUB",
}) => {
  const [copiedState, setCopiedState] = useState(false);

  const defaultPortalUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/login`;
    }
    return "https://pradeepclasses.in/login";
  }, []);

  const portalUrl = credentials?.portalUrl || defaultPortalUrl;

  const handleCopyCredentials = async () => {
    if (!credentials) return;
    const msg = buildCredentialsMessage({
      name: credentials.name,
      username: credentials.username,
      password: credentials.password,
      portalUrl,
      isReset: credentials.isReset,
    });

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg);
      }
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2500);
    } catch {
      // Fallback
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "student":
        return "info";
      case "teacher":
        return "warning";
      case "admin":
        return "violet";
      case "owner":
        return "amber";
      case "super_admin":
        return "violet";
      default:
        return "neutral";
    }
  };

  if (!credentials) return null;

  const modalTitle =
    title ||
    (credentials.isReset
      ? "Password Updated Successfully"
      : "User Account Provisioned");

  const messageText = buildCredentialsMessage({
    name: credentials.name,
    username: credentials.username,
    password: credentials.password,
    portalUrl,
    isReset: credentials.isReset,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={subtitle}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <Check size={16} className="text-emerald-600 shrink-0" />
          <span>
            {credentials.isReset
              ? "The password has been securely updated."
              : "The user account is now active and ready for login."}
          </span>
        </div>

        {/* Credentials Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-sans">
            <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider">
              Account Details
            </span>
            <Badge variant={getRoleBadgeVariant(credentials.role)} size="sm">
              {credentials.role}
            </Badge>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 block font-sans">Full Name:</span>
            <span className="font-bold text-slate-800 text-sm font-sans">
              {credentials.name}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 block font-sans">Portal URL:</span>
            <span className="font-semibold text-[#16466f] select-all break-all">
              {portalUrl}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 block font-sans">Login Username / Reg No:</span>
            <span className="font-bold text-slate-900 select-all break-all">
              {credentials.username}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 block font-sans">Password:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 select-all inline-block">
              {credentials.password}
            </span>
          </div>

          {credentials.phone && (
            <div>
              <span className="text-[11px] text-slate-500 block font-sans">Phone Number:</span>
              <span className="text-slate-800">{credentials.phone}</span>
            </div>
          )}
        </div>

        {/* Dispatch Action Buttons */}
        <div className="space-y-2 pt-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyCredentials}
            className="w-full h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
          >
            {copiedState ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={15} className="text-slate-500" />
                <span>Copy Credentials to Clipboard</span>
              </>
            )}
          </button>

          {/* WhatsApp Share Button */}
          {credentials.phone ? (
            <a
              href={formatWhatsAppUrl(credentials.phone, messageText)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>
                {whatsAppButtonLabel
                  ? `${whatsAppButtonLabel} (${credentials.phone})`
                  : `Send via WhatsApp (${credentials.phone})`}
              </span>
              <ExternalLink size={13} className="opacity-75" />
            </a>
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500 text-xs text-center">
              <span>No phone number registered for WhatsApp delivery. You can copy the credentials above.</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
