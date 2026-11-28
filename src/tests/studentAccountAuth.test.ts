import { supabase } from '../lib/supabase';

async function testStudentAuth() {
  console.log('Testing authentication for student PC-2025-0001...');
  const normalizedEmail = 'pc-2025-0001@student.pradeepclasses.in';
  const password = 'PRADEEPCLASSES';

  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: password,
  });

  if (error) {
    throw new Error(`Student sign-in failed: ${error.message}`);
  }

  console.log('Student authenticated successfully!');
  console.log('User ID:', auth.user?.id);
  console.log('User email:', auth.user?.email);

  // Verify profile
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user?.id)
    .single();

  if (pErr) throw new Error(`Profile query failed: ${pErr.message}`);
  console.log('Student profile:', profile);

  if (profile.role !== 'student') {
    throw new Error(`Expected role 'student', got ${profile.role}`);
  }

  // Verify student linkage
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, admission_no, profile_id')
    .eq('profile_id', auth.user?.id)
    .single();

  if (sErr) throw new Error(`Student record linkage failed: ${sErr.message}`);
  console.log('Linked student record:', student);

  if (student.admission_no !== 'PC-2025-0001') {
    throw new Error(`Expected admission_no 'PC-2025-0001', got ${student.admission_no}`);
  }

  console.log('Task 2 verified cleanly: Student login and record linkage verified!');
}

testStudentAuth().catch((err) => {
  console.error('Task 2 test failed:', err);
  process.exit(1);
});
