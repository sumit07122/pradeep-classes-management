import { supabase } from '../lib/supabase';
import { feesService } from '../services/feesService';

async function testHistoricalFees() {
  console.log('Testing historical fee payment recording...');

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, admission_no')
    .eq('admission_no', 'PC-2025-0001')
    .single();

  if (!student) throw new Error('Student PC-2025-0001 not found');

  const testReceiptNo = `HIST-${Date.now().toString().slice(-6)}`;
  const recordRes = await feesService.recordHistoricalPayment({
    student_id: student.id,
    amount: 1500,
    paid_date: '2026-10-10',
    historical_period: 'October 2026',
    receipt_no: testReceiptNo,
    payment_mode: 'cash',
    notes: 'Prior offline fee receipt verified from manual register',
  });

  if (!recordRes.success || !recordRes.data) {
    throw new Error(`Failed to record historical payment: ${recordRes.error}`);
  }
  console.log('Historical payment recorded successfully:', recordRes.data.id);

  // Fetch through service to verify mapping
  const { data: records, error } = await feesService.getFeeRecords({ query: testReceiptNo });
  if (error) throw new Error(error);

  const found = records.find((r) => r.receipt_no === testReceiptNo);
  if (!found) throw new Error('Expected historical record not found in fee records query');

  console.log('Verified loaded fee record:');
  console.log('- Title:', found.title);
  console.log('- Amount:', found.amount);
  console.log('- Status:', found.status);
  console.log('- Is Historical:', found.is_historical);
  console.log('- Historical Period:', found.historical_period);

  if (!found.is_historical) {
    throw new Error('Expected is_historical to be true');
  }

  // Cleanup test record
  await supabase.from('fee_records').delete().eq('id', recordRes.data.id);
  console.log('Task 4 verified cleanly!');
}

testHistoricalFees().catch((err) => {
  console.error('Task 4 test failed:', err);
  process.exit(1);
});
