import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  console.log('=== WHATSAPP DISPATCH MANAGEMENT & SETTINGS NOTICE TESTS ===\n');

  // Step 1: Authenticate as admin
  console.log('--- Test 1: Admin Authentication ---');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) {
    throw new Error(`Admin authentication failed: ${authErr.message}`);
  }
  console.log('✓ Admin authenticated successfully.');

  // Step 2: Create a new manual WhatsApp dispatch
  console.log('\n--- Test 2: Create manual WhatsApp dispatch ---');
  const createRes = await whatsappService.createQueueItem({
    recipient_phone: '9876543210',
    recipient_name: 'Test Student Dispatch',
    event_type: 'announcement',
    message_body: 'Dear Student, this is a test notification from Pradeep Classes.',
  });

  if (!createRes.success || !createRes.data) {
    throw new Error(`Failed to create dispatch: ${createRes.error}`);
  }
  const dispatchId = createRes.data.id;
  console.log(`✓ Dispatch created successfully with ID: ${dispatchId}`);
  assertTrue(createRes.data.recipient_phone === '919876543210', 'Phone normalized with 91 prefix');

  // Step 3: Update WhatsApp dispatch
  console.log('\n--- Test 3: Update WhatsApp dispatch ---');
  const updateRes = await whatsappService.updateQueueItem(dispatchId, {
    recipient_name: 'Updated Student Name',
    message_body: 'Updated message text for dispatch verification.',
  });

  if (!updateRes.success) {
    throw new Error(`Failed to update dispatch: ${updateRes.error}`);
  }
  console.log('✓ Dispatch updated successfully.');

  // Verify updated in DB
  const { data: updatedItem } = await supabase
    .from('whatsapp_message_queue')
    .select('recipient_name, message_body')
    .eq('id', dispatchId)
    .single();

  assertTrue(updatedItem?.recipient_name === 'Updated Student Name', 'Recipient name updated');
  assertTrue(updatedItem?.message_body === 'Updated message text for dispatch verification.', 'Body updated');
  console.log('✓ Database verification confirms updated dispatch fields.');

  // Step 4: Delete WhatsApp dispatch
  console.log('\n--- Test 4: Delete WhatsApp dispatch ---');
  const deleteRes = await whatsappService.deleteQueueItem(dispatchId);
  if (!deleteRes.success) {
    throw new Error(`Failed to delete dispatch: ${deleteRes.error}`);
  }
  console.log('✓ Dispatch deleted successfully.');

  // Verify deleted from DB
  const { data: deletedCheck } = await supabase
    .from('whatsapp_message_queue')
    .select('id')
    .eq('id', dispatchId)
    .maybeSingle();

  assertTrue(!deletedCheck, 'Dispatch confirmed removed from database.');
  console.log('✓ Database verification confirms clean deletion.');

  console.log('\nALL WHATSAPP DISPATCH LIFECYCLE TESTS PASSED! ✓✓✓');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
