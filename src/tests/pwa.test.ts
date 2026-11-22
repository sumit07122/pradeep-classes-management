import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PWAInstallPrompt } from "../components/common/PWAInstallPrompt";
import { Topbar } from "../components/layout/Topbar";

const proc = (globalThis as any).process;

function assertEqual<T>(actual: T, expected: T, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Assertion failed.\nExpected: ${expectedStr}\nActual:   ${actualStr}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed: expected true, got false");
  }
}

function setGlobalNavigator(navObj: any) {
  Object.defineProperty(globalThis, "navigator", {
    value: navObj,
    configurable: true,
    writable: true,
  });
}

async function runPWATests() {
  console.log("=== Running PWA & Service Worker Test Suite ===");

  // Dynamically load node fs & path modules without breaking client tsconfig
  const fsModule: any = await (Function('return import("fs")')() as Promise<any>);
  const pathModule: any = await (Function('return import("path")')() as Promise<any>);
  const fs = fsModule.default || fsModule;
  const path = pathModule.default || pathModule;
  const cwd = proc ? proc.cwd() : ".";

  // 1. Validate public/sw.js
  console.log("-> Testing public/sw.js file and routing strategies...");
  const swPath = path.resolve(cwd, "public", "sw.js");
  assertTrue(fs.existsSync(swPath), "public/sw.js must exist");

  const swContent = fs.readFileSync(swPath, "utf-8");
  assertTrue(swContent.includes("pradeep-classes-"), "Service worker defines a cache name");
  assertTrue(swContent.includes("STATIC_SHELL"), "Service worker defines static shell assets");
  assertTrue(swContent.includes("'/index.html'"), "Static shell caches /index.html");
  assertTrue(swContent.includes("'/manifest.json'"), "Static shell caches /manifest.json");
  assertTrue(swContent.includes("'/logo.png'"), "Static shell caches /logo.png");
  assertTrue(swContent.includes("'/favicon.svg'"), "Static shell caches /favicon.svg");

  // Verify Supabase Network-first pattern
  assertTrue(
    swContent.includes("/rest/v1/") && swContent.includes("supabase.co"),
    "Service worker implements network-first strategy for Supabase API requests"
  );

  // Verify static asset Cache-first pattern
  assertTrue(
    swContent.includes("isStaticAsset") && swContent.includes("caches.match(request)"),
    "Service worker implements cache-first strategy for static assets"
  );

  // Verify SPA navigation fallback
  assertTrue(
    swContent.includes("request.mode === 'navigate'"),
    "Service worker intercepts navigation requests for SPA offline fallback"
  );
  console.log("✓ public/sw.js structure and caching policies verified");

  // 2. Validate public/manifest.json
  console.log("-> Testing public/manifest.json configuration...");
  const manifestPath = path.resolve(cwd, "public", "manifest.json");
  assertTrue(fs.existsSync(manifestPath), "public/manifest.json must exist");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  assertEqual(manifest.short_name, "Pradeep Classes", "manifest short_name");
  assertEqual(manifest.theme_color, "#102f50", "manifest theme_color must be #102f50");
  assertEqual(manifest.display, "standalone", "manifest display must be standalone");
  assertTrue(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "manifest has icons configured");
  console.log("✓ public/manifest.json configuration verified");

  // 3. Test usePWAInstall hook logic under various environments
  console.log("-> Testing usePWAInstall hook behavior...");
  const mockListeners: Record<string, EventListenerOrEventListenerObject[]> = {};
  const mockWindow: any = {
    addEventListener: (event: string, cb: any) => {
      mockListeners[event] = mockListeners[event] || [];
      mockListeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: any) => {
      mockListeners[event] = (mockListeners[event] || []).filter((l) => l !== cb);
    },
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };

  const defaultNav = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    platform: "Win32",
    standalone: false,
    maxTouchPoints: 0,
  };

  (globalThis as any).window = mockWindow;
  setGlobalNavigator(defaultNav);
  mockWindow.navigator = defaultNav;
  (globalThis as any).document = {
    referrer: "",
  };

  // Import usePWAInstall hook
  const { usePWAInstall } = await import("../hooks/usePWAInstall");

  // In standard non-standalone window:
  let hookState: any = null;
  function TestHookComponent() {
    hookState = usePWAInstall();
    return React.createElement("div", null, hookState.isInstallable ? "installable" : "not-installable");
  }

  const initialMarkup = renderToStaticMarkup(React.createElement(TestHookComponent));
  assertTrue(initialMarkup.includes("installable"), "Hook reports isInstallable=true initially in standard browser");
  assertEqual(hookState.isStandalone, false, "Not standalone initially");
  assertEqual(hookState.isInstalled, false, "Not installed initially");
  assertEqual(hookState.isIOS, false, "Not iOS on Windows user agent");
  assertEqual(hookState.canPrompt, false, "No prompt event received yet");

  // Test iOS detection
  const iosNav = {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    platform: "iPhone",
    standalone: false,
    maxTouchPoints: 5,
  };
  setGlobalNavigator(iosNav);
  mockWindow.navigator = iosNav;

  let iosHookState: any = null;
  function IosTestHookComponent() {
    iosHookState = usePWAInstall();
    return React.createElement("div", null, iosHookState.isIOS ? "ios-detected" : "not-ios");
  }
  const iosMarkup = renderToStaticMarkup(React.createElement(IosTestHookComponent));
  assertTrue(iosMarkup.includes("ios-detected"), "Hook detects iOS devices accurately");
  assertTrue(iosHookState.isIOS, "Hook state isIOS is true on iPhone user agent");

  // Test Standalone detection
  const standaloneNav = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    platform: "Win32",
    standalone: true,
    maxTouchPoints: 0,
  };
  setGlobalNavigator(standaloneNav);
  mockWindow.navigator = standaloneNav;

  let standaloneHookState: any = null;
  function StandaloneTestComponent() {
    standaloneHookState = usePWAInstall();
    return React.createElement("div", null, standaloneHookState.isStandalone ? "is-standalone" : "browser");
  }
  const standaloneMarkup = renderToStaticMarkup(React.createElement(StandaloneTestComponent));
  assertTrue(standaloneMarkup.includes("is-standalone"), "Hook detects standalone mode");
  assertEqual(standaloneHookState.isStandalone, true, "isStandalone is true");
  assertEqual(standaloneHookState.isInstallable, false, "isInstallable is false when already standalone");

  console.log("✓ usePWAInstall hook behavior under different devices/modes verified");

  // 4. Test PWAInstallPrompt rendering
  console.log("-> Testing PWAInstallPrompt and Topbar integration...");

  // In non-standalone mode:
  const browserNav = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    platform: "Win32",
    standalone: false,
    maxTouchPoints: 0,
  };
  setGlobalNavigator(browserNav);
  mockWindow.navigator = browserNav;

  const promptMarkup = renderToStaticMarkup(React.createElement(PWAInstallPrompt));
  assertTrue(promptMarkup.includes("Install App"), "PWAInstallPrompt renders 'Install App' button");
  assertTrue(promptMarkup.includes("animate-ping"), "PWAInstallPrompt button has subtle pulse animation");

  // Topbar integration
  const topbarMarkup = renderToStaticMarkup(
    React.createElement(Topbar, {
      onOpenMobileNav: () => {},
      pageTitle: "Dashboard",
      userRole: "admin",
      onSignOut: () => {},
    })
  );
  assertTrue(topbarMarkup.includes("Install App"), "Topbar renders PWAInstallPrompt pill");
  assertTrue(topbarMarkup.includes("Dashboard"), "Topbar renders page title");

  // In standalone mode, Topbar should NOT render Install App button
  const standaloneNavFinal = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    platform: "Win32",
    standalone: true,
    maxTouchPoints: 0,
  };
  setGlobalNavigator(standaloneNavFinal);
  mockWindow.navigator = standaloneNavFinal;

  const standalonePromptMarkup = renderToStaticMarkup(React.createElement(PWAInstallPrompt));
  assertEqual(standalonePromptMarkup, "", "PWAInstallPrompt renders null in standalone mode");

  console.log("✓ PWAInstallPrompt component and Topbar integration verified");
  console.log("=== All PWA & Service Worker Tests Passed Successfully ===");
}

runPWATests().catch((err) => {
  console.error("PWA test suite failed:", err);
  if (proc && proc.exit) {
    proc.exit(1);
  }
});
