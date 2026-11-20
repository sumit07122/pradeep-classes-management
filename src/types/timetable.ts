export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface TimetableEntry {
  id: string;
  institute_id: string;
  batch_id: string;
  batch_name?: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  subject: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  room_number?: string | null;
  is_active: boolean;
  created_at: string;
}
