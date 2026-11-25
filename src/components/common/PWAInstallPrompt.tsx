import React, { useState, useEffect } from "react";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle,
  X,
  Monitor,
  Check,
} from "lucide-react";

export interface PWAInstallPromptProps {
  className?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ className = "" }) => {
  const { isInstallable, isInstalled, isIOS, isStandalone, canPrompt, triggerInstall } =
    usePWAInstall();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // If already running standalone or installed, hide prompt pill
  if (isStandalone || isInstalled || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const success = await triggerInstall();
      if (success) {
        setInstalledSuccess(true);
        setTimeout(() => {
          setIsModalOpen(false);
        }, 2200);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <>
      {/* Sleek Topbar Pill Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#102f50] hover:bg-[#184574] text-white border border-[#2b5177] shadow-xs transition-all duration-200 active:scale-95 group text-xs font-semibold cursor-pointer select-none ${className}`}
        title="Install Pradeep Classes as App"
        aria-label="Install App"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs" aria-hidden="true">📲</span>
        <span className="text-[11px] font-bold tracking-tight">Install App</span>
      </button>

      {/* Installation Guide & Prompt Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Pradeep Classes"
                  className="w-10 h-10 rounded-xl shadow-xs border border-slate-100 object-cover"
                />
                <div>
                  <h3
                    id="pwa-install-title"
                    className="text-base font-extrabold text-slate-900 font-sans tracking-tight"
                  >
                    Install Pradeep Classes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Offline-ready mobile & desktop experience
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dynamic Modal Content */}
            {installedSuccess ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">App Installed Successfully!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Pradeep Classes is now installed on your device. You can launch it anytime from
                  your home screen or apps menu.
                </p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-5 px-4 py-2 bg-[#102f50] text-white text-xs font-bold rounded-lg hover:bg-[#184574] transition cursor-pointer"
                >
                  Got it
                </button>
              </div>
            ) : isIOS ? (
              /* iOS Safari Visual 3-Step Guide */
              <div className="py-4 space-y-4">
                <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
                  <Smartphone size={16} className="text-amber-700 shrink-0" />
                  <span>Follow these 3 quick steps in Apple Safari:</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Tap Share icon <Share size={13} className="text-blue-600 inline" />
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Tap the Share button in the Safari toolbar (bottom on iPhone, top on iPad).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Scroll & tap "Add to Home Screen"{" "}
                        <PlusSquare size={13} className="text-emerald-600 inline" />
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Scroll through the action options and select <b>Add to Home Screen</b>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Tap "Add" <CheckCircle size={13} className="text-purple-600 inline" />
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Tap <b>Add</b> in the top-right corner to finish. The app icon will appear
                        on your home screen.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-1 text-[11px] text-slate-400 text-center">
                  Tip: Make sure you are using Safari browser on your iOS device.
                </div>
              </div>
            ) : canPrompt ? (
              /* Android / Chrome / Edge 1-Click Install */
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-base mb-1" aria-hidden="true">⚡</div>
                    <div className="text-[11px] font-bold text-slate-800">Instant Load</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Zero browser latency</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-base mb-1" aria-hidden="true">📶</div>
                    <div className="text-[11px] font-bold text-slate-800">Offline Ready</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Access records offline</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-base mb-1" aria-hidden="true">📱</div>
                    <div className="text-[11px] font-bold text-slate-800">Full Screen</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Native app feel</div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#102f50] hover:bg-[#184574] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-70 cursor-pointer"
                  >
                    <Download size={15} />
                    <span>{isInstalling ? "Installing..." : "Install Now"}</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  Fast 1-click install • No app store required • Small footprint
                </p>
              </div>
            ) : (
              /* Desktop Standalone Experience Explainer */
              <div className="py-4 space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Monitor size={15} className="text-blue-600" /> Standalone Desktop Window
                    Experience
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Install Pradeep Classes on your Mac, Windows PC, or Chromebook for a dedicated
                    workspace window without browser tabs or address bar distractions.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-700 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider text-slate-500">
                    How to Install:
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">1.</span>
                    <span>
                      Look for the <b>Install App</b> icon (⊕ or 💻) in your browser address bar.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">2.</span>
                    <span>
                      Or open browser menu (⋮ / ⋯) and click <b>"Install Pradeep Classes..."</b>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#102f50] hover:bg-[#184574] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-70 cursor-pointer"
                >
                  <Download size={15} />
                  <span>{isInstalling ? "Installing..." : "Attempt 1-Click Install"}</span>
                </button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
