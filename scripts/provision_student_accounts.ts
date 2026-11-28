import { supabase } from '../src/lib/supabase';

const DEFAULT_PASSWORD = 'PRADEEPCLASSES';

async function main() {
  console.log('Authenticating as Institute Admin...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  console.log('Fetching all enrolled students...');
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, admission_no, profile_id, phone')
    .order('admission_no', { ascending: true });

  if (sErr) throw new Error(`Fetch students failed: ${sErr.message}`);
  console.log(`Found ${students.length} students to verify / provision.`);

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const s of students) {
    if (s.profile_id) {
      // Check if user already exists
      skippedCount++;
      continue;
    }

    const email = `${s.admission_no.toLowerCase()}@student.pradeepclasses.in`;

    try {
      const { data, error } = await supabase.rpc('admin_create_institute_user', {
        p_email: email,
        p_password: DEFAULT_PASSWORD,
        p_full_name: s.full_name,
        p_role: 'student',
        p_student_id: s.id,
        p_teacher_id: null,
        p_phone: null, // Sibling phones can collide, keep auth phone null to prevent uniqueness conflict
      });

      if (error) {
        // If user already exists with this email, link profile_id directly
        if (error.message.includes('already exists')) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('full_name', s.full_name)
            .maybeSingle();

          if (existingUser) {
            await supabase
              .from('students')
              .update({ profile_id: existingUser.id, email: email })
              .eq('id', s.id);
            skippedCount++;
            continue;
          }
        }
        console.warn(`Failed to provision student ${s.admission_no} (${s.full_name}):`, error.message);
        errorCount++;
      } else {
        createdCount++;
        if (createdCount % 10 === 0 || createdCount === students.length) {
          console.log(`Progress: ${createdCount} accounts created...`);
        }
      }
    } catch (err: any) {
      console.error(`Exception for ${s.admission_no}:`, err.message);
      errorCount++;
    }
  }

  console.log('====================================================');
  console.log(`PROVISIONING SUMMARY:`);
  console.log(`- Created: ${createdCount}`);
  console.log(`- Already Linked / Skipped: ${skippedCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log(`- Total Students: ${students.length}`);
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error in provisioning:', err);
  process.exit(1);
});
