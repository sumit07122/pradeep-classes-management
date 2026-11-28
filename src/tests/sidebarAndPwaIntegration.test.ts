import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { AppShell } from '../components/layout/AppShell';

function assertTrue(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${msg} (expected '${expected}', got '${actual}')`);
  }
}

async function runTests() {
  console.log('=== SIDEBAR COLLAPSE & INSTITUTE SWITCH REMOVAL TESTS ===\n');

  // Test 1: Sidebar does not render institute-switch box
  console.log('--- Test 1: Verify institute-switch box is removed from Sidebar ---');
  const sidebarMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(Sidebar, {
        isOpen: false,
        onClose: () => {},
        userRole: 'student',
        onSignOut: () => {},
      })
    )
  );

  assertTrue(!sidebarMarkup.includes('institute-switch'), 'Sidebar must not contain institute-switch box');
  assertTrue(!sidebarMarkup.includes('ChevronDown'), 'Sidebar does not contain dropdown chevron in brand');
  assertTrue(sidebarMarkup.includes('Pradeep Classes'), 'Sidebar renders institute name');
  assertTrue(sidebarMarkup.includes('sidebar-close-btn'), 'Sidebar renders collapse/hide button');
  console.log('✓ institute-switch box successfully verified as removed.');

  // Test 2: Sidebar responds to isCollapsed prop
  console.log('\n--- Test 2: Verify isCollapsed prop adds sidebar-collapsed class ---');
  const collapsedSidebarMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(Sidebar, {
        isOpen: false,
        onClose: () => {},
        isCollapsed: true,
        userRole: 'admin',
        onSignOut: () => {},
      })
    )
  );

  assertTrue(collapsedSidebarMarkup.includes('sidebar-collapsed'), 'Sidebar contains sidebar-collapsed class');
  console.log('✓ sidebar-collapsed class correctly applied.');

  // Test 3: Topbar renders sidebar toggle button accessible to all roles
  console.log('\n--- Test 3: Topbar sidebar-toggle-btn presence for student, teacher, and admin ---');
  for (const role of ['student', 'teacher', 'admin', 'owner'] as const) {
    const topbarMarkup = renderToStaticMarkup(
      React.createElement(Topbar, {
        onOpenMobileNav: () => {},
        onToggleSidebar: () => {},
        isSidebarCollapsed: false,
        pageTitle: 'Test Page',
        userRole: role,
        onSignOut: () => {},
      })
    );

    assertTrue(topbarMarkup.includes('sidebar-toggle-btn'), `Topbar has sidebar-toggle-btn for role ${role}`);
    assertTrue(topbarMarkup.includes('Hide sidebar navigation'), `Topbar tooltip reflects active state for ${role}`);
  }
  console.log('✓ Topbar toggle button verified for all roles (student, teacher, admin, owner).');

  // Test 4: AppShell wraps page and supports collapsed state
  console.log('\n--- Test 4: AppShell integration ---');
  const appShellMarkup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AppShell,
        {
          userRole: 'teacher',
          pageTitle: 'Teacher Schedule',
          onSignOut: () => {},
        },
        React.createElement('div', { id: 'test-content' }, 'Hello Content')
      )
    )
  );

  assertTrue(appShellMarkup.includes('main-area'), 'AppShell contains main-area');
  assertTrue(appShellMarkup.includes('Hello Content'), 'AppShell renders children');
  assertTrue(!appShellMarkup.includes('institute-switch'), 'AppShell has clean sidebar without redundant switch box');
  console.log('✓ AppShell renders cleanly.');

  console.log('\nALL SIDEBAR COLLAPSE & REMOVAL TESTS PASSED! ✓✓✓');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
