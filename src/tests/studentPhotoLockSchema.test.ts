import { supabase } from '../lib/supabase';

async function testSchemaAndRPC() {
  console.log('Authenticating as Admin...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  console.log('Verifying columns on students...');
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, admission_no, is_profile_locked, photo_uploaded_at')
    .limit(1);

  if (sErr) throw new Error(`Query students failed: ${sErr.message}`);
  console.log('Students column check successful:', students[0]);

  console.log('Verifying columns on fee_records...');
  const { data: fees, error: fErr } = await supabase
    .from('fee_records')
    .select('id, is_historical, historical_period')
    .limit(1);

  if (fErr) throw new Error(`Query fee_records failed: ${fErr.message}`);
  console.log('Fee records column check successful:', fees[0]);

  console.log('Testing lock_student_profile RPC...');
  const testStudentId = students[0].id;
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('lock_student_profile', {
    p_student_id: testStudentId,
    p_photo_url: 'https://example.com/test-photo.jpg',
  });

  if (rpcErr) throw new Error(`lock_student_profile failed: ${rpcErr.message}`);
  console.log('RPC execution result:', rpcRes);

  if (!rpcRes.is_profile_locked) {
    throw new Error('Expected is_profile_locked to be true');
  }

  // Reset lock for clean state
  await supabase
    .from('students')
    .update({ is_profile_locked: false, photo_url: null })
    .eq('id', testStudentId);

  console.log('Task 1 verified cleanly!');
}

testSchemaAndRPC().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
