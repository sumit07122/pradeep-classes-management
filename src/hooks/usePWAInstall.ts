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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== "undefined" && (window as any).__deferredPWAInstallPrompt) {
      return (window as any).__deferredPWAInstallPrompt;
    }
    return null;
  });

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

    // Check early captured prompt
    if ((window as any).__deferredPWAInstallPrompt && !deferredPrompt) {
      setDeferredPrompt((window as any).__deferredPWAInstallPrompt);
    }

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
      (window as any).__deferredPWAInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredPWAInstallPrompt = null;
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
  }, [deferredPrompt]);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || (typeof window !== "undefined" ? (window as any).__deferredPWAInstallPrompt : null);
    if (!promptEvent) {
      return false;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          (window as any).__deferredPWAInstallPrompt = null;
        }
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
