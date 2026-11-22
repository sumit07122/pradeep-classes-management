import { useState, useEffect, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface UsePWAInstallReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  canPrompt: boolean;
  triggerInstall: () => Promise<boolean>;
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Detect standalone mode (already running installed)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const isStandaloneDisplay = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    const isNavigatorStandalone = Boolean((window.navigator as unknown as { standalone?: boolean })?.standalone);
    const isAndroidApp = typeof document !== "undefined" && document.referrer.includes("android-app://");
    return isStandaloneDisplay || isNavigatorStandalone || isAndroidApp;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandalone);

  // Detect iOS Safari
  const [isIOS] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
    const isMacWithTouch = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return isAppleDevice || isMacWithTouch;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check display-mode media query changes
    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setIsInstalled(true);
      }
    };

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", handleDisplayModeChange);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // Capture Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log("[PWA] Pradeep Classes app was successfully installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[PWA] Installation prompt failed:", err);
      return false;
    }
  }, [deferredPrompt]);

  const isInstallable = !isStandalone && !isInstalled;

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isStandalone,
    canPrompt: Boolean(deferredPrompt),
    triggerInstall,
  };
}
