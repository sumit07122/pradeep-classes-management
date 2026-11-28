import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';

async function runTests() {
  console.log('--- TEST 1: Faculty Authentication with Canonical Email ---');
  const { data: facultyAuth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'avinash.sir@faculty.pradeepclasses.in',
    password: 'PRADEEPCLASSES',
  });

  if (authErr || !facultyAuth.user) {
    throw new Error(`Faculty login failed: ${authErr?.message}`);
  }
  console.log(`✓ Faculty login succeeded for Avinash Sir (${facultyAuth.user.id})`);

  // Verify profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', facultyAuth.user.id)
    .single();

  if (profErr || !profile) {
    throw new Error(`Profile fetch failed: ${profErr?.message}`);
  }
  if (profile.role !== 'teacher') {
    throw new Error(`Expected role 'teacher', got '${profile.role}'`);
  }
  console.log(`✓ Role verified as '${profile.role}' for ${profile.full_name}`);

  // Sign out faculty
  await supabase.auth.signOut();

  console.log('--- TEST 2: Admin Sign-in & Staff Account Management Lifecycle ---');
  const { error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (adminAuthErr) {
    throw new Error(`Admin auth failed: ${adminAuthErr.message}`);
  }
  console.log('✓ Admin authenticated successfully.');

  // Create temporary staff user
  const testEmail = `test.staff.${Date.now()}@faculty.pradeepclasses.in`;
  const createRes = await userService.createInstituteUser({
    full_name: 'Test Temporary Staff',
    email: testEmail,
    password: 'TemporaryPass123',
    role: 'teacher',
  });

  if (createRes.error || !createRes.data) {
    throw new Error(`Failed to create test staff: ${createRes.error}`);
  }
  const testUserId = createRes.data.id;
  console.log(`✓ Test staff user created with ID ${testUserId}`);

  // Test toggle status (deactivate)
  const deactRes = await userService.toggleUserStatus(testUserId, false);
  if (!deactRes.success) {
    throw new Error(`Failed to deactivate staff: ${deactRes.error}`);
  }
  console.log('✓ User successfully deactivated.');

  // Verify status in DB
  const { data: deactUser } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', testUserId)
    .single();

  if (deactUser?.is_active !== false) {
    throw new Error('Expected user is_active to be false');
  }
  console.log('✓ Verified is_active is false in database.');

  // Test delete / unlink user
  const deleteRes = await userService.deleteInstituteUser(testUserId);
  if (!deleteRes.success) {
    throw new Error(`Failed to delete user: ${deleteRes.error}`);
  }
  console.log('✓ User successfully deleted and unlinked.');

  // Verify user no longer exists in profiles
  const { data: deletedProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', testUserId)
    .maybeSingle();

  if (deletedProfile) {
    throw new Error('User profile still exists after deletion');
  }
  console.log('✓ Verified user profile completely removed.');

  // Test protection: cannot delete owner
  const { data: ownerUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'owner')
    .limit(1)
    .single();

  if (ownerUser) {
    const ownerDeleteRes = await userService.deleteInstituteUser(ownerUser.id);
    if (ownerDeleteRes.success) {
      throw new Error('Expected owner deletion to fail, but it succeeded!');
    }
    console.log(`✓ Protected account safety check passed: cannot delete institute owner (${ownerDeleteRes.error})`);
  }

  console.log('--- ALL STAFF ACCOUNT MANAGEMENT TESTS PASSED (5/5) ---');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
