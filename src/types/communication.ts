export interface Announcement {
  id: string;
  institute_id: string;
  title: string;
  message: string;
  content?: string;
  target_role: string;
  target_type?: "all" | "batch" | "staff";
  batch_id?: string | null;
  batch_name?: string | null;
  priority: string;
  is_pinned?: boolean;
  created_by?: string | null;
  created_at: string;
}

export interface WhatsAppMessageQueueItem {
  id: string;
  institute_id: string;
  student_id?: string | null;
  student_name?: string;
  phone_number: string;
  message_type: string;
  message_body: string;
  status: "pending" | "sent" | "failed" | "skipped_test_mode";
  attempts: number;
  max_attempts: number;
  error_message?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export type WhatsAppMessage = WhatsAppMessageQueueItem;
