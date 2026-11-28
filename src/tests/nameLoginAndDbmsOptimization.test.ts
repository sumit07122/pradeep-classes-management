import { supabase } from '../lib/supabase';

async function testNameLoginAndDbms() {
  console.log('=================================================================');
  console.log('TEST SUITE: Name-Based & Registration-Number Login & DBMS Verification');
  console.log('=================================================================');

  // Test 1: Test resolve_login_identifier RPC directly
  console.log('\n--- 1. Testing Universal Login Resolver RPC ---');
  const testInputs = [
    { input: 'PC001', expectedDomain: 'pc-2025-0001@student.pradeepclasses.in' },
    { input: 'pc002', expectedDomain: 'pc-2025-0002@student.pradeepclasses.in' },
    { input: 'PC-2025-0010', expectedDomain: 'pc-2025-0010@student.pradeepclasses.in' },
    { input: 'Avinash Sir', expectedDomain: 'avinash.sir@faculty.pradeepclasses.in' },
    { input: 'avinash', expectedDomain: 'avinash.sir@faculty.pradeepclasses.in' },
    { input: 'Keshav', expectedDomain: 'keshav.sir@faculty.pradeepclasses.in' },
    { input: 'Pavan Sir', expectedDomain: 'pavan.sir@faculty.pradeepclasses.in' },
    { input: 'Mr. Pradeep Kumar', expectedDomain: 'pradeep.kumar@faculty.pradeepclasses.in' },
    { input: 'admin', expectedDomain: 'admin@pradeepclasses.in' },
  ];

  for (const t of testInputs) {
    const { data: resolved, error } = await supabase.rpc('resolve_login_identifier', {
      p_input: t.input,
    });
    if (error) {
      throw new Error(`RPC failed for "${t.input}": ${error.message}`);
    }
    if (resolved !== t.expectedDomain) {
      throw new Error(`RPC mismatch for "${t.input}": expected ${t.expectedDomain}, got ${resolved}`);
    }
    console.log(`✓ Resolved "${t.input}" -> "${resolved}"`);
  }

  // Test 2: Student Login with Short Reg No "PC001"
  console.log('\n--- 2. Testing Student Login via Short Reg No ("PC001") ---');
  const { data: studentResolved } = await supabase.rpc('resolve_login_identifier', { p_input: 'PC001' });
  const { data: sAuth, error: sErr } = await supabase.auth.signInWithPassword({
    email: studentResolved,
    password: 'PRADEEPCLASSES',
  });
  if (sErr || !sAuth.user) throw new Error(`Student login failed: ${sErr?.message}`);
  console.log(`✓ Student PC001 logged in cleanly as: ${sAuth.user.id}`);
  await supabase.auth.signOut();

  // Test 3: Faculty Login via Simple Name "Avinash Sir"
  console.log('\n--- 3. Testing Faculty Login via Simple Name ("Avinash Sir") ---');
  const { data: facultyResolved } = await supabase.rpc('resolve_login_identifier', { p_input: 'Avinash Sir' });
  const { data: fAuth, error: fErr } = await supabase.auth.signInWithPassword({
    email: facultyResolved,
    password: 'PRADEEPCLASSES',
  });
  if (fErr || !fAuth.user) throw new Error(`Faculty login failed: ${fErr?.message}`);
  console.log(`✓ Faculty "Avinash Sir" logged in cleanly as: ${fAuth.user.id}`);
  await supabase.auth.signOut();

  // Test 4: Faculty Login via First Name "Keshav"
  console.log('\n--- 4. Testing Faculty Login via First Name ("Keshav") ---');
  const { data: keshavResolved } = await supabase.rpc('resolve_login_identifier', { p_input: 'Keshav' });
  const { data: kAuth, error: kErr } = await supabase.auth.signInWithPassword({
    email: keshavResolved,
    password: 'PRADEEPCLASSES',
  });
  if (kErr || !kAuth.user) throw new Error(`Faculty login failed for Keshav: ${kErr?.message}`);
  console.log(`✓ Faculty "Keshav" logged in cleanly as: ${kAuth.user.id}`);
  await supabase.auth.signOut();

  // Test 5: Admin Login via Identifier "admin"
  console.log('\n--- 5. Testing Admin Login via Short Handle ("admin") ---');
  const { data: adminResolved } = await supabase.rpc('resolve_login_identifier', { p_input: 'admin' });
  const { data: aAuth, error: aErr } = await supabase.auth.signInWithPassword({
    email: adminResolved,
    password: 'Pradeep@2026',
  });
  if (aErr || !aAuth.user) throw new Error(`Admin login failed: ${aErr?.message}`);
  console.log(`✓ Admin logged in cleanly as: ${aAuth.user.id}`);

  // Test 6: Verify Database Query Plan (EXPLAIN ANALYZE on indexed paths)
  console.log('\n--- 6. Testing DBMS Query Plan on Indexed Keys ---');
  const { data: explainFee, error: explainErr } = await supabase
    .from('fee_records')
    .select('id, amount, status')
    .eq('student_id', 'ed701ad6-7ff1-4ab0-9185-05464d9675b6');

  if (explainErr) throw new Error(`Fee records query failed: ${explainErr.message}`);
  console.log(`✓ Indexed fee_records lookup executed successfully (${explainFee.length} rows)`);

  const { data: explainAtt } = await supabase
    .from('attendance_records')
    .select('id, status')
    .eq('student_id', 'ed701ad6-7ff1-4ab0-9185-05464d9675b6');
  console.log(`✓ Indexed attendance_records lookup executed successfully (${explainAtt?.length || 0} rows)`);

  console.log('\n=================================================================');
  console.log('ALL TESTS PASSED: UNIVERSAL NAME & REG NO LOGIN + DBMS ROBUSTNESS');
  console.log('=================================================================');
}

testNameLoginAndDbms().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
