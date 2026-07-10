"use client";

import { createContext, useContext, useState, useEffect } from "react";

const TipsContext = createContext(false);

export function useTips() {
  return useContext(TipsContext);
}

export function TipsProvider({ children }: { children: React.ReactNode }) {
  const [tipsEnabled, setTipsEnabled] = useState(false);

  useEffect(() => {
    // Only show tips if user has never dismissed them on this browser
    if (!localStorage.getItem("ltc_tips_dismissed")) {
      setTipsEnabled(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("ltc_tips_dismissed", "1");
    setTipsEnabled(false);
  }

  if (!tipsEnabled) return <>{children}</>;

  return (
    <TipsContext.Provider value={true}>
      {children}
      {/* Dismiss banner — fixed bottom-right, above mobile nav */}
      <div
        className="fixed bottom-20 right-4 md:bottom-6 z-50 flex items-center gap-2.5 rounded-full px-3.5 py-2 shadow-lg text-xs font-medium"
        style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
      >
        <span style={{ opacity: 0.7 }}>Hover elements for tips</span>
        <button
          onClick={dismiss}
          className="font-semibold cursor-pointer hover:opacity-70 transition-opacity"
          aria-label="Dismiss tips"
        >
          Got it ×
        </button>
      </div>
    </TipsContext.Provider>
  );
}
