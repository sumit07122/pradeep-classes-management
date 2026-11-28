import { supabase } from '../src/lib/supabase';

async function main() {
  const { data: adminUser } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  console.log('Admin user signed in:', adminUser.user?.id);

  // Check profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('full_name', ['Pradeep Classes Owner', 'Aarohi Singh']);
  console.log('Profiles:', profiles);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
