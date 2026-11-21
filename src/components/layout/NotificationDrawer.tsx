import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  X,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import type { UserRole } from "../../types";

interface NotificationItem {
  id: string;
  type: "announcement" | "fee_alert" | "attendance_alert" | "system";
  title: string;
  message: string;
  created_at: string;
  priority?: string;
  link?: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  userRole,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pc_read_notifications") || "[]");
    } catch {
      return [];
    }
  });

  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const loadNotifications = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);

    try {
      const items: NotificationItem[] = [];

      // 1. Fetch institute broadcast announcements
      const { data: annData } = await supabase
        .from("announcements")
        .select("id, title, message, priority, target_audience, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      (annData || []).forEach((a) => {
        items.push({
          id: a.id,
          type: "announcement",
          title: a.title,
          message: a.message,
          created_at: a.created_at,
          priority: a.priority,
          link: userRole === "student" ? "/portal" : "/announcements",
        });
      });

      // 2. If management role, check for system alerts (pending WhatsApp, defaulters)
      if (userRole === "owner" || userRole === "admin" || userRole === "super_admin") {
        const [{ count: failedQueueCount }, { count: pendingFeeCount }] = await Promise.all([
          supabase
            .from("whatsapp_message_queue")
            .select("id", { count: "exact", head: true })
            .eq("status", "failed"),
          supabase
            .from("fee_records")
            .select("id", { count: "exact", head: true })
            .eq("status", "overdue"),
        ]);

        if (failedQueueCount && failedQueueCount > 0) {
          items.push({
            id: "system-whatsapp-failed",
            type: "system",
            title: "WhatsApp Dispatch Alert",
            message: `${failedQueueCount} notification(s) failed delivery and need retry.`,
            created_at: new Date().toISOString(),
            priority: "high",
            link: "/announcements",
          });
        }

        if (pendingFeeCount && pendingFeeCount > 0) {
          items.push({
            id: "system-fees-overdue",
            type: "fee_alert",
            title: "Overdue Fee Invoices",
            message: `${pendingFeeCount} student invoice(s) are overdue for payment.`,
            created_at: new Date().toISOString(),
            priority: "urgent",
            link: "/fees",
          });
        }
      }

      setNotifications(items);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    localStorage.setItem("pc_read_notifications", JSON.stringify(allIds));
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
      <div
        ref={drawerRef}
        className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slideLeft"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#16466f]/10 text-[#16466f] flex items-center justify-center font-bold">
              <Bell size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Notifications & Alerts</h3>
              <p className="text-[11px] text-slate-500">
                {unreadCount > 0 ? `${unreadCount} unread notices` : "All caught up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-[#16466f] hover:underline px-2 py-1"
              >
                Mark Read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading notices...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 italic">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2 opacity-80" />
              <p className="font-semibold text-slate-700">No new notifications</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All broadcast messages and alerts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isRead = readIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border text-xs transition relative ${
                    isRead
                      ? "bg-slate-50/50 border-slate-200/70 opacity-80"
                      : "bg-white border-[#16466f]/30 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                        item.priority === "urgent"
                          ? "bg-rose-100 text-rose-700"
                          : item.type === "fee_alert"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-[#16466f]"
                      }`}
                    >
                      {item.type.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs mt-1">{item.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  {item.link && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
                      <Link
                        to={item.link}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16466f] hover:underline"
                      >
                        View Details <ExternalLink size={11} />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
          <span>Pradeep Classes Notification Center</span>
          <Link
            to={userRole === "student" ? "/portal" : "/announcements"}
            onClick={onClose}
            className="font-bold text-[#16466f] hover:underline"
          >
            All Broadcasts →
          </Link>
        </div>
      </div>
    </div>
  );
};
