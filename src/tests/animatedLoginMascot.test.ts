import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnimatedLoginMascot } from '../components/auth/AnimatedLoginMascot';
import { Input } from '../components/common/Input';
import fs from 'fs';
import path from 'path';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  console.log('=== ANIMATED LOGIN MASCOT & SHOW PASSWORD INTERACTION TESTS ===\n');

  // Test 1: Mascot Idle State
  console.log('--- Test 1: Mascot in Idle State ---');
  const idleHtml = renderToString(
    React.createElement(AnimatedLoginMascot, {
      isEmailFocused: false,
      isPasswordFocused: false,
      showPassword: false,
      textLength: 0,
    })
  );

  assertTrue(idleHtml.includes('svg'), 'Mascot renders SVG element');
  assertTrue(idleHtml.includes('translate(0px, 0px)'), 'Paws are at resting position when idle');
  assertTrue(idleHtml.includes('Mortarboard Diamond Top') || idleHtml.includes('polygon'), 'Mascot wears academic scholar graduation cap');
  console.log('✓ Idle mascot renders scholar cap, ears, and resting paws.');

  // Test 2: Username / Email Focused State (Gaze Downward Tracking)
  console.log('\n--- Test 2: Username Focus & Text Tracking ---');
  const emailFocusedHtml = renderToString(
    React.createElement(AnimatedLoginMascot, {
      isEmailFocused: true,
      isPasswordFocused: false,
      showPassword: false,
      textLength: 14,
    })
  );

  assertTrue(emailFocusedHtml.includes('translate('), 'Pupil has translation applied');
  assertTrue(emailFocusedHtml.includes('4.2px'), 'Pupils look downwards towards registration number input');
  console.log('✓ Username focus smoothly shifts pupil gaze downward to track input text.');

  // Test 3: Password Focused (Masked - No Peeking)
  console.log('\n--- Test 3: Password Focused with Masked Characters ---');
  const passwordMaskedHtml = renderToString(
    React.createElement(AnimatedLoginMascot, {
      isEmailFocused: false,
      isPasswordFocused: true,
      showPassword: false,
      textLength: 0,
    })
  );

  assertTrue(passwordMaskedHtml.includes('-58px'), 'Paws move up by -58px to cover eyes');
  assertTrue(passwordMaskedHtml.includes('rotate(-6deg)'), 'Left paw angled over left eye');
  assertTrue(passwordMaskedHtml.includes('rotate(6deg)'), 'Right paw angled over right eye');
  console.log('✓ When password field is active, both paws raise and cover eyes.');

  // Test 4: Show Password Toggled (Peek State)
  console.log('\n--- Test 4: Show Password Active (One-Paw Peek) ---');
  const passwordPeekHtml = renderToString(
    React.createElement(AnimatedLoginMascot, {
      isEmailFocused: false,
      isPasswordFocused: true,
      showPassword: true,
      textLength: 0,
    })
  );

  // Left paw remains covering left eye
  assertTrue(passwordPeekHtml.includes('-58px'), 'Left paw stays covering left eye');
  // Right paw lowers and tilts to uncover right eye
  assertTrue(passwordPeekHtml.includes('-20px'), 'Right paw drops to -20px uncovering right eye');
  assertTrue(passwordPeekHtml.includes('rotate(28deg)'), 'Right paw tilts sideways for cheeky peek');
  // Right eyebrow raises high
  assertTrue(passwordPeekHtml.includes('M 111 67 Q 119 62 127 67'), 'Right eyebrow raises playfully in curiosity');
  console.log('✓ One-paw peek animation exposes right eye while left stays covered.');

  // Test 5: Input Component Supports rightElement
  console.log('\n--- Test 5: Input Component Right Element / Eye Toggle ---');
  const inputWithRightElement = renderToString(
    React.createElement(Input, {
      label: 'Password',
      type: 'password',
      rightElement: React.createElement('button', { id: 'toggle-btn' }, 'Eye'),
    })
  );

  assertTrue(inputWithRightElement.includes('pr-10'), 'Input applies pr-10 to prevent text overlap with toggle icon');
  assertTrue(inputWithRightElement.includes('toggle-btn'), 'Input renders rightElement');
  console.log('✓ Input component renders rightElement with proper padding.');

  // Test 6: Verify Login.tsx integrates AnimatedLoginMascot and Show Password toggle
  console.log('\n--- Test 6: Verify Login.tsx file integration ---');
  const loginFilePath = path.resolve(process.cwd(), 'src/pages/Login.tsx');
  const loginSource = fs.readFileSync(loginFilePath, 'utf8');

  assertTrue(loginSource.includes('AnimatedLoginMascot'), 'Login.tsx imports and renders AnimatedLoginMascot');
  assertTrue(loginSource.includes('showPassword'), 'Login.tsx contains showPassword state');
  assertTrue(loginSource.includes('isEmailFocused'), 'Login.tsx tracks registration focus state');
  assertTrue(loginSource.includes('isPasswordFocused'), 'Login.tsx tracks password focus state');
  assertTrue(loginSource.includes('EyeOff'), 'Login.tsx provides interactive eye toggle icon button');
  assertTrue(loginSource.includes('Show password'), 'Login.tsx provides show password checkbox option');
  console.log('✓ Login.tsx fully wires mascot state and interactive password toggles.');

  console.log('\n======================================================');
  console.log('🎉 ALL ANIMATED MASCOT & SHOW PASSWORD TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
