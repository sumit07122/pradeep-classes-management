import { supabase } from '../src/lib/supabase';

const DEFAULT_PASSWORD = 'PRADEEPCLASSES';

function generateCanonicalFacultyEmail(fullName: string): string {
  // Strip "Mr. ", "Sir", "Dr. "
  const clean = fullName
    .replace(/^Mr\.\s+/i, '')
    .replace(/\s+Sir$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.');

  if (fullName.toLowerCase().includes('avinash')) return 'avinash.sir@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('pavan')) return 'pavan.sir@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('keshav')) return 'keshav.sir@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('umashankar')) return 'umashankar.sir@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('pradeep')) return 'pradeep.kumar@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('chaudhary')) return 'akash.chaudhary@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('kuntal')) return 'akash.kuntal@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('goyal')) return 'jitendra.goyal@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('radhe')) return 'radheshyam.sir@faculty.pradeepclasses.in';
  if (fullName.toLowerCase().includes('rajesh')) return 'rajesh.gupta@faculty.pradeepclasses.in';

  return `${clean}@faculty.pradeepclasses.in`;
}

async function main() {
  console.log('Authenticating as Institute Administrator...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  console.log('Fetching all faculty members...');
  const { data: teachers, error: tErr } = await supabase
    .from('teachers')
    .select('id, full_name, subject, phone, profile_id')
    .order('full_name', { ascending: true });

  if (tErr) throw new Error(`Fetch teachers failed: ${tErr.message}`);
  console.log(`Found ${teachers.length} faculty members.`);

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const t of teachers) {
    const email = generateCanonicalFacultyEmail(t.full_name);
    console.log(`Processing: ${t.full_name} -> ${email}`);

    if (t.profile_id) {
      console.log(`  Already linked with profile_id ${t.profile_id}. Skipping.`);
      skippedCount++;
      continue;
    }

    try {
      const { data, error } = await supabase.rpc('admin_create_institute_user', {
        p_email: email,
        p_password: DEFAULT_PASSWORD,
        p_full_name: t.full_name,
        p_role: 'teacher',
        p_student_id: null,
        p_teacher_id: t.id,
        p_phone: t.phone || null,
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`  User already exists with email ${email}, linking profile_id...`);
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (existingUser) {
            await supabase
              .from('teachers')
              .update({ profile_id: existingUser.id })
              .eq('id', t.id);
            console.log(`  Linked existing profile ${existingUser.id} to teacher ${t.full_name}.`);
            createdCount++;
            continue;
          }
        }
        console.warn(`  Failed for ${t.full_name}:`, error.message);
        errorCount++;
      } else {
        console.log(`  Successfully created and linked account for ${t.full_name}!`);
        createdCount++;
      }
    } catch (err: any) {
      console.error(`  Exception for ${t.full_name}:`, err.message);
      errorCount++;
    }
  }

  console.log('====================================================');
  console.log(`FACULTY PROVISIONING SUMMARY:`);
  console.log(`- Created & Linked: ${createdCount}`);
  console.log(`- Already Linked: ${skippedCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log(`- Total Teachers: ${teachers.length}`);
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error in faculty provisioning:', err);
  process.exit(1);
});
