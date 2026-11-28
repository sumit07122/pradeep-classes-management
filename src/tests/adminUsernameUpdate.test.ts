import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';

async function runTests() {
  console.log('=== ADMIN USERNAME UPDATE & IDENTIFIER SYNCHRONIZATION TESTS ===\n');

  // Step 1: Unit / Mock testing for error conditions
  console.log('--- Test 1: Validation checks on updateUserUsername ---');
  const emptyUserRes = await userService.updateUserUsername('', 'newname');
  if (emptyUserRes.success || !emptyUserRes.error?.includes('User ID')) {
    throw new Error('Expected failure on missing User ID');
  }
  console.log('✓ Rejected empty User ID as expected.');

  const emptyUsernameRes = await userService.updateUserUsername('some-id', '   ');
  if (emptyUsernameRes.success || !emptyUsernameRes.error?.includes('cannot be empty')) {
    throw new Error('Expected failure on blank new username');
  }
  console.log('✓ Rejected blank username as expected.');

  // Step 2: Admin Sign-in
  console.log('\n--- Test 2: Admin Authentication ---');
  const { error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (adminAuthErr) {
    throw new Error(`Admin authentication failed: ${adminAuthErr.message}`);
  }
  console.log('✓ Admin authenticated successfully.');

  // Step 3: Create a test user to perform username change
  console.log('\n--- Test 3: Provision temporary user for username modification ---');
  const initialUsername = `testuser_${Date.now()}`;
  const initialEmail = `${initialUsername}@pradeepclasses.in`;
  const createRes = await userService.createInstituteUser({
    full_name: 'Test Changeable User',
    email: initialEmail,
    password: 'PRADEEPCLASSES',
    role: 'teacher',
  });

  if (!createRes.data) {
    throw new Error(`Failed to create test user: ${createRes.error}`);
  }
  const targetUserId = createRes.data.id;
  console.log(`✓ Temporary user created (ID: ${targetUserId}) with initial email: ${initialEmail}`);

  // Step 4: Perform username change via userService
  console.log('\n--- Test 4: Change username via userService.updateUserUsername ---');
  const updatedHandle = `new_teacher_handle_${Date.now()}`;
  const updateRes = await userService.updateUserUsername(targetUserId, updatedHandle);

  if (!updateRes.success) {
    throw new Error(`updateUserUsername failed: ${updateRes.error}`);
  }
  console.log(`✓ RPC execution succeeded:`, updateRes.data);

  // Step 5: Test login resolution with the new handle
  console.log('\n--- Test 5: Verify login resolution resolves updated handle ---');
  const { data: resolvedEmail, error: resolveErr } = await supabase.rpc(
    'resolve_login_identifier',
    {
      p_input: updatedHandle,
    }
  );

  if (resolveErr) {
    throw new Error(`resolve_login_identifier failed: ${resolveErr.message}`);
  }
  console.log(`✓ resolve_login_identifier returned: ${resolvedEmail}`);

  const expectedEmail = updateRes.data.new_email;
  if (resolvedEmail !== expectedEmail) {
    throw new Error(`Expected resolved email '${expectedEmail}', got '${resolvedEmail}'`);
  }
  console.log(`✓ New username correctly resolves to: ${resolvedEmail}`);

  // Step 6: Cleanup test user
  console.log('\n--- Test 6: Cleanup test account ---');
  const delRes = await userService.deleteInstituteUser(targetUserId);
  if (!delRes.success) {
    console.warn(`Warning: Failed to cleanup test user: ${delRes.error}`);
  } else {
    console.log(`✓ Temporary test user deleted and cleaned up.`);
  }

  console.log('\nALL TESTS PASSED SUCCESSFULLY! ✓✓✓');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
