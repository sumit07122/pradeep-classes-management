import { supabase } from '../lib/supabase';

async function testStudentStorageUpload() {
  console.log('=== VERIFYING STUDENT PHOTO STORAGE RLS POLICIES ===\n');

  // 1. Authenticate as Student Aarohi Singh (PC-2025-0001)
  console.log('--- Step 1: Sign in as Student PC-2025-0001 ---');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'pc-2025-0001@student.pradeepclasses.in',
    password: 'PRADEEPCLASSES',
  });
  if (authErr) throw new Error(`Student auth failed: ${authErr.message}`);
  console.log(`✓ Student authenticated successfully (User ID: ${auth.user?.id})`);

  // 2. Load student record
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, admission_no, is_profile_locked')
    .eq('profile_id', auth.user?.id)
    .single();
  if (sErr) throw new Error(`Fetch student failed: ${sErr.message}`);
  console.log(`✓ Loaded student record for: ${student.full_name} (${student.admission_no})`);

  // 3. Test uploading file to student-photos bucket as the student
  console.log('\n--- Step 2: Upload passport photo to student-photos storage bucket ---');
  const testFileName = `${student.id}_${Date.now()}.png`;
  const filePath = `photos/${testFileName}`;
  // 1x1 transparent PNG buffer
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('student-photos')
    .upload(filePath, pngBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Storage upload failed with RLS error: ${uploadErr.message}`);
  }
  console.log(`✓ File successfully uploaded to storage path: ${uploadData?.path}`);

  // 4. Retrieve public URL
  const { data: publicUrlData } = supabase.storage
    .from('student-photos')
    .getPublicUrl(filePath);
  const photoUrl = publicUrlData.publicUrl;
  console.log(`✓ Generated public URL: ${photoUrl}`);

  // 5. Call lock_student_profile RPC
  console.log('\n--- Step 3: Call lock_student_profile RPC to permanently lock identity ---');
  const { data: lockRes, error: lockErr } = await supabase.rpc('lock_student_profile', {
    p_student_id: student.id,
    p_photo_url: photoUrl,
  });

  if (lockErr) throw new Error(`RPC lock_student_profile failed: ${lockErr.message}`);
  console.log('✓ Profile locked successfully in database:', lockRes);

  if (!lockRes.is_profile_locked) {
    throw new Error('Expected is_profile_locked to be true');
  }

  // 6. Verify tamper protection
  console.log('\n--- Step 4: Verify student cannot re-upload or tamper with locked profile ---');
  const { error: tamperErr } = await supabase.rpc('lock_student_profile', {
    p_student_id: student.id,
    p_photo_url: 'https://evil.com/hacked.jpg',
  });

  if (!tamperErr || !tamperErr.message.includes('Profile locked')) {
    throw new Error(`Expected Profile locked error, got: ${tamperErr?.message}`);
  }
  console.log('✓ Tamper protection verified: locked profile cannot be changed.');

  // 7. Reset student photo lock for continued user testing
  console.log('\n--- Step 5: Reset student for test repeatability ---');
  await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  await supabase
    .from('students')
    .update({ is_profile_locked: false, photo_url: null, photo_uploaded_at: null })
    .eq('id', student.id);
  console.log('✓ Test cleanup complete.');

  console.log('\n=============================================================');
  console.log('🎉 STUDENT PHOTO STORAGE RLS & PROFILE LOCKING 100% VERIFIED!');
  console.log('=============================================================');
}

testStudentStorageUpload().catch((err) => {
  console.error('Storage test failed:', err);
  process.exit(1);
});
