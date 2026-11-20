export interface GradeThreshold {
  grade: string;
  min: number;
}

export interface InstituteSettings {
  id: string;
  institute_id: string;
  institute_name: string;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  website?: string | null;
  logo_url?: string | null;
  academic_year: string;
  default_pass_percentage: number;
  fee_late_fine_daily: number;
  currency_symbol: string;
  timezone: string;
  meta?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSettings {
  id: string;
  institute_id: string;
  is_enabled: boolean;
  phone_number_id?: string | null;
  waba_id?: string | null;
  access_token?: string | null;
  test_mode: boolean;
  verified_number?: string | null;
  send_present_alert: boolean;
  send_absent_alert: boolean;
  send_late_alert: boolean;
  send_leave_alert: boolean;
  send_fee_receipt_alert: boolean;
  send_exam_result_alert: boolean;
  created_at: string;
  updated_at: string;
}
