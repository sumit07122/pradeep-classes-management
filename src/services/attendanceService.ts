import { supabase } from '../lib/supabase';
import type {
  AttendanceSession,
  RollCallStudent,
  AttendanceSummary,
  SaveAttendancePayload,
  StudentAttendanceStats,
  BatchDefaulter,
  AttendanceStatus,
} from '../types';

export const attendanceService = {
  /**
   * Loads batch roll call for a given date, merging active batch students with any existing records.
   */
  async getBatchRollCall(
    batchId: string,
    sessionDate: string
  ): Promise<{
    session: AttendanceSession | null;
    students: RollCallStudent[];
    summary: AttendanceSummary;
  }> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    // 1. Fetch all active students enrolled in this batch
    const { data: studentsData, error: studentsErr } = await supabase
      .from('students')
      .select('id, full_name, admission_no, roll_no, status')
      .eq('batch_id', batchId)
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (studentsErr) {
      console.error('Error fetching batch students for roll call:', studentsErr);
      throw studentsErr;
    }

    const enrolledStudents = studentsData || [];

    // 2. Fetch attendance session for this batch and date
    const { data: sessionData, error: sessionErr } = await supabase
      .from('attendance_sessions')
      .select('id, batch_id, session_date, taken_by, institute_id, created_at, profiles(full_name)')
      .eq('batch_id', batchId)
      .eq('session_date', sessionDate)
      .maybeSingle();

    if (sessionErr) {
      console.error('Error fetching attendance session:', sessionErr);
      throw sessionErr;
    }

    let recordsMap = new Map<string, { id: string; status: AttendanceStatus; note: string | null }>();

    let session: AttendanceSession | null = null;
    if (sessionData) {
      session = {
        id: sessionData.id,
        batch_id: sessionData.batch_id,
        session_date: sessionData.session_date,
        taken_by: sessionData.taken_by,
        institute_id: sessionData.institute_id,
        created_at: sessionData.created_at,
        taken_by_name: (sessionData.profiles as any)?.full_name || undefined,
      };

      // 3. Fetch attendance records for this session
      const { data: recordsData, error: recordsErr } = await supabase
        .from('attendance_records')
        .select('id, student_id, status, note')
        .eq('session_id', sessionData.id);

      if (recordsErr) {
        console.error('Error fetching attendance records:', recordsErr);
        throw recordsErr;
      }

      if (recordsData) {
        recordsData.forEach((r) => {
          recordsMap.set(r.student_id, {
            id: r.id,
            status: r.status as AttendanceStatus,
            note: r.note,
          });
        });
      }
    }

    // 4. Merge students with records
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;

    const rollCallList: RollCallStudent[] = enrolledStudents.map((s) => {
      const existing = recordsMap.get(s.id);
      const status: AttendanceStatus = existing ? existing.status : 'present'; // default present
      const note = existing?.note || undefined;

      if (status === 'present') presentCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'late') lateCount++;
      else if (status === 'leave') leaveCount++;

      return {
        student_id: s.id,
        full_name: s.full_name,
        admission_no: s.admission_no,
        roll_no: s.roll_no || undefined,
        status,
        note,
        record_id: existing?.id,
      };
    });

    const totalEnrolled = enrolledStudents.length;
    const attendedCount = presentCount + lateCount;
    const attendanceRate = totalEnrolled > 0 ? Math.round((attendedCount / totalEnrolled) * 100) : 100;

    return {
      session,
      students: rollCallList,
      summary: {
        total_enrolled: totalEnrolled,
        present_count: presentCount,
        absent_count: absentCount,
        late_count: lateCount,
        leave_count: leaveCount,
        attendance_rate: attendanceRate,
      },
    };
  },

  /**
   * Saves or updates full batch roll call using the atomic PostgreSQL RPC.
   */
  async saveBatchAttendance(payload: SaveAttendancePayload): Promise<{
    success: boolean;
    session_id: string;
    total_marked: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    leave_count: number;
  }> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    const { data, error } = await supabase.rpc('submit_batch_attendance', {
      p_batch_id: payload.batch_id,
      p_session_date: payload.session_date,
      p_records: payload.records,
    });

    if (error) {
      console.error('Error submitting batch attendance RPC:', error);
      throw error;
    }

    return data as any;
  },

  /**
   * Fetches students with attendance below threshold (default 75%).
   */
  async getBatchDefaulters(batchId: string, threshold: number = 75.0): Promise<BatchDefaulter[]> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    const { data, error } = await supabase.rpc('get_batch_attendance_defaulters', {
      p_batch_id: batchId,
      p_threshold: threshold,
    });

    if (error) {
      console.error('Error fetching batch defaulters RPC:', error);
      throw error;
    }

    return (data || []) as BatchDefaulter[];
  },

  /**
   * Fetches overall attendance summary for a student.
   */
  async getStudentAttendanceSummary(studentId: string): Promise<StudentAttendanceStats> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    const { data, error } = await supabase.rpc('get_student_attendance_summary', {
      p_student_id: studentId,
    });

    if (error) {
      console.error('Error fetching student attendance summary RPC:', error);
      throw error;
    }

    return data as StudentAttendanceStats;
  },

  /**
   * Fetches recent attendance logs for a student (for Student/Parent portal).
   */
  async getStudentRecentAttendance(
    studentId: string,
    limit: number = 10
  ): Promise<
    {
      id: string;
      session_date: string;
      batch_name: string;
      status: AttendanceStatus;
      note: string | null;
      marked_at: string;
    }[]
  > {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, status, note, marked_at, attendance_sessions(session_date, batches(name))')
      .eq('student_id', studentId)
      .order('marked_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching student recent attendance:', error);
      throw error;
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      session_date: r.attendance_sessions?.session_date || '',
      batch_name: r.attendance_sessions?.batches?.name || 'Assigned Batch',
      status: r.status as AttendanceStatus,
      note: r.note,
      marked_at: r.marked_at,
    }));
  },

  /**
   * Exports roll call records to CSV.
   */
  exportAttendanceToCsv(batchName: string, sessionDate: string, students: RollCallStudent[]): void {
    const headers = ['Admission No', 'Student Name', 'Roll No', 'Attendance Status', 'Notes'];
    const rows = students.map((s) => [
      `"${s.admission_no}"`,
      `"${s.full_name}"`,
      `"${s.roll_no || ''}"`,
      `"${s.status.toUpperCase()}"`,
      `"${(s.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_${batchName.replace(/\s+/g, '_')}_${sessionDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
