import { supabase } from '../lib/supabase';
import { attendanceService } from '../services/attendanceService';
import { academicsService } from '../services/academicsService';
import { financeService } from '../services/financeService';

async function runOperationsVerification() {
  console.log('--- 1. Authenticating as Institute Admin ---');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  console.log('--- 2. Fetching Junior Foundation Batch ---');
  const { data: batch, error: bErr } = await supabase
    .from('batches')
    .select('id, name')
    .eq('name', 'Junior Foundation (Classes 1st–3rd)')
    .single();

  if (bErr || !batch) throw new Error(`Batch not found: ${bErr?.message}`);
  console.log(`Found batch: ${batch.name} (${batch.id})`);

  console.log('--- 3. Testing Batch Roll Call ---');
  const rollCall = await attendanceService.getBatchRollCall(batch.id, '2026-11-28');
  console.log(`Loaded ${rollCall.students.length} students in roll-call.`);
  if (rollCall.students.length !== 15) {
    throw new Error(`Expected 15 students in Junior Foundation, found ${rollCall.students.length}`);
  }
  console.log('Sample student:', rollCall.students[0].full_name, rollCall.students[0].admission_no);

  console.log('--- 4. Testing Attendance Submission ---');
  const attendanceRecords = rollCall.students.map((s, idx) => ({
    student_id: s.student_id,
    status: (idx % 5 === 0 ? 'absent' : 'present') as any,
    note: idx % 5 === 0 ? 'Informed leave' : null,
  }));

  const saveRes = await attendanceService.saveBatchAttendance({
    batch_id: batch.id,
    session_date: '2026-11-28',
    records: attendanceRecords,
  });
  console.log(`Attendance saved: Session ID ${saveRes.session_id}, ${saveRes.saved_count} records recorded.`);

  console.log('--- 5. Testing Academics & Scheduled Exams ---');
  const examsRes = await academicsService.getExams();
  if (examsRes.error) throw new Error(examsRes.error);
  console.log(`Loaded ${examsRes.data.length} exams.`);
  if (examsRes.data.length < 3) {
    throw new Error(`Expected at least 3 scheduled exams, found ${examsRes.data.length}`);
  }
  examsRes.data.forEach(e => {
    console.log(`- [${e.exam_type}] ${e.title} (${e.batch_name}) on ${e.exam_date}`);
  });

  console.log('--- 6. Testing Teacher Payrolls & Configurations ---');
  const payrolls = await financeService.getTeacherPayrolls('2026-11');
  console.log(`Payrolls loaded for 2026-11: ${payrolls.length} faculty sheets.`);
  if (payrolls.length !== 10) {
    throw new Error(`Expected 10 faculty payroll records, found ${payrolls.length}`);
  }

  const configs = await financeService.getTeacherSalaryConfigs();
  console.log(`Teacher salary configs loaded: ${configs.length} configs.`);
  if (configs.length !== 10) {
    throw new Error(`Expected 10 faculty salary configs, found ${configs.length}`);
  }

  console.log('====================================================');
  console.log('ALL OPERATIONAL WORKFLOWS VERIFIED SUCCESSFULLY!');
  console.log('====================================================');
}

runOperationsVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
