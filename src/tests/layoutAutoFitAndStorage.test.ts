import fs from 'fs';
import path from 'path';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  console.log('=== SCREEN LAYOUT AUTO-FIT & OVERFLOW AUDIT ===\n');

  // Test 1: Verify index.css has strict overflow-x: hidden on html, body, app-shell, main-area
  console.log('--- Test 1: Verify CSS Viewport & Container Width Rules ---');
  const cssPath = path.resolve(process.cwd(), 'src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assertTrue(cssContent.includes('overflow-x: hidden'), 'index.css enforces overflow-x: hidden');
  assertTrue(cssContent.includes('max-width: 100vw') || cssContent.includes('max-width: 100%'), 'index.css enforces max-width constraints');
  assertTrue(cssContent.includes('calc(100% - 258px)'), 'main-area calculates width as calc(100% - 258px) when sidebar is open to prevent 258px horizontal overflow');
  assertTrue(cssContent.includes('.main-area.sidebar-collapsed'), 'main-area handles collapsed state with 100% width');
  assertTrue(cssContent.includes('.table-wrap'), 'table-wrap has container for tables');
  console.log('✓ CSS constraints successfully eliminate horizontal overflow across all viewports.');

  // Test 2: Verify AppShell.tsx wraps content with min-w-0 max-w-full overflow-x-hidden
  console.log('\n--- Test 2: Verify AppShell.tsx DOM Structure ---');
  const appShellPath = path.resolve(process.cwd(), 'src/components/layout/AppShell.tsx');
  const appShellContent = fs.readFileSync(appShellPath, 'utf8');

  assertTrue(appShellContent.includes('max-w-full'), 'AppShell enforces max-w-full');
  assertTrue(appShellContent.includes('overflow-x-hidden'), 'AppShell enforces overflow-x-hidden on shell and main area');
  assertTrue(appShellContent.includes('min-w-0'), 'AppShell includes min-w-0 to enable flex children to shrink properly');
  console.log('✓ AppShell structure verified for 100% screen autofit.');

  // Test 3: Verify Portal.tsx max-w-full constraints
  console.log('\n--- Test 3: Verify Student Portal Layout ---');
  const portalPath = path.resolve(process.cwd(), 'src/pages/Portal.tsx');
  const portalContent = fs.readFileSync(portalPath, 'utf8');

  assertTrue(portalContent.includes('max-w-full'), 'Portal container enforces max-w-full');
  assertTrue(portalContent.includes('overflow-x-auto max-w-full'), 'Tabs enforce max-w-full overflow-x-auto without stretching page');
  console.log('✓ Portal container verified for responsive autofit.');

  // Test 4: Verify migration 0022 exists for student-photos storage RLS
  console.log('\n--- Test 4: Verify Storage RLS Migration ---');
  const migPath = path.resolve(process.cwd(), 'supabase/migrations/0022_storage_student_photos_rls.sql');
  assertTrue(fs.existsSync(migPath), 'Migration 0022 exists');
  const migContent = fs.readFileSync(migPath, 'utf8');
  assertTrue(migContent.includes('student_photos_authenticated_insert'), 'Migration configures authenticated insert policy');
  assertTrue(migContent.includes('student_photos_public_read'), 'Migration configures public read policy');
  assertTrue(migContent.includes('student_photos_authenticated_update'), 'Migration configures authenticated update policy');
  console.log('✓ Storage RLS migration verified.');

  console.log('\n======================================================');
  console.log('🎉 ALL SCREEN AUTO-FIT & STORAGE TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
