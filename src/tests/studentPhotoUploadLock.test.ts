import { supabase } from '../lib/supabase';

async function testPhotoUploadLock() {
  console.log('Testing student photo upload and immutable profile lock...');

  // 1. Authenticate as student Aarohi Singh (PC-2025-0001)
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'pc-2025-0001@student.pradeepclasses.in',
    password: 'PRADEEPCLASSES',
  });
  if (authErr) throw new Error(`Student auth failed: ${authErr.message}`);

  // 2. Fetch student record
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, admission_no, is_profile_locked')
    .eq('profile_id', auth.user?.id)
    .single();

  if (sErr) throw new Error(`Query student failed: ${sErr.message}`);
  console.log('Student loaded:', student.full_name, 'Locked:', student.is_profile_locked);

  // 3. Call lock_student_profile as student
  const testPhotoUrl = 'https://app.pradeepclasses.in/sample-passport.jpg';
  const { data: lockRes, error: lockErr } = await supabase.rpc('lock_student_profile', {
    p_student_id: student.id,
    p_photo_url: testPhotoUrl,
  });

  if (lockErr) throw new Error(`lock_student_profile failed: ${lockErr.message}`);
  console.log('Profile locked successfully by student:', lockRes);

  if (!lockRes.is_profile_locked) {
    throw new Error('Expected is_profile_locked to be true');
  }

  // 4. Verify tampering is blocked: student attempts to call lock_student_profile again
  const { error: tamperErr } = await supabase.rpc('lock_student_profile', {
    p_student_id: student.id,
    p_photo_url: 'https://malicious.com/fake.jpg',
  });

  if (!tamperErr || !tamperErr.message.includes('Profile locked')) {
    throw new Error(`Expected tamper prevention error 'Profile locked', got: ${tamperErr?.message}`);
  }
  console.log('✓ Tamper prevention confirmed: Locked profile cannot be re-uploaded or modified by student.');

  // 5. Reset for clean state
  await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  await supabase
    .from('students')
    .update({ is_profile_locked: false, photo_url: null })
    .eq('id', student.id);

  console.log('Task 3 verified cleanly!');
}

testPhotoUploadLock().catch((err) => {
  console.error('Task 3 test failed:', err);
  process.exit(1);
});
