"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

interface TourStep {
  title: string;
  body: string;
  targetSelector?: string;
  ctaLabel?: string;
  navigateTo?: string;
  // For Pro-gated pages: Pro users go here, free users go to /pricing instead
  proNavigateTo?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Lock The Code! 🔒",
    body: "Your smart technical interview study companion powered by spaced repetition. Let's take a quick tour so you know exactly where everything is.",
    ctaLabel: "Add Your First Problem →",
    navigateTo: "/dashboard",
  },
  {
    title: "Your Problem Library",
    body: "Here you'll see every LeetCode problem you've logged. You can sync reviews to Google Calendar, view your notes and original problem link, edit, or delete a problem.",
  },
  {
    title: "Log a Problem",
    body: "Click '+ Add Problem' below to record a LeetCode question you've solved recently. It'll appear right here, and you'll receive an email reminder when it's due for spaced repetition review!",
    targetSelector: "[data-tour='add-problem']",
    ctaLabel: "See the Review Queue →",
    navigateTo: "/review",
  },
  {
    title: "Your Review Queue",
    body: "Problems due for review appear here, scheduled automatically by the spaced repetition algorithm. Click the card to expand your notes and jump directly to the original problem link.",
  },
  {
    title: "Rate Your Confidence",
    body: "After attempting a problem, rate how well you remembered it. Hard problems come back sooner; mastered ones appear less and less often.",
    ctaLabel: "Check out Flashcards →",
    navigateTo: "/flashcards",
  },
  {
    title: "Algorithm Pattern Flashcards",
    body: "Reinforce patterns like Sliding Window, Binary Search, Two Pointers, and Dynamic Programming with spaced repetition flashcards. System cards are completely free for everyone!",
  },
  {
    title: "That's all the free features! ✓",
    body: "You've just seen problem tracking, spaced repetition review, and pattern flashcards, all free. Now let's see what Pro unlocks...",
    ctaLabel: "Explore Pro →",
    proNavigateTo: "/chat/tutor",
  },
  {
    title: "AI Tutor (Pro)",
    body: "Stuck on a problem? Ask your AI tutor — whether it's on your list or any LeetCode question. It gives Socratic hints that guide your thinking without handing you the answer.",
    targetSelector: "[data-tour='ai-tutor']",
    ctaLabel: "Meet the Interviewer →",
    proNavigateTo: "/chat/interview",
  },
  {
    title: "AI Interviewer (Pro)",
    body: "Run a live mock interview session. Choose your target company, seniority level, and question type — technical, behavioral, or system design. Just like the real thing.",
    targetSelector: "[data-tour='ai-interview']",
  },
  {
    title: "Need Help?",
    body: "Find our contact form anytime by clicking the profile icon in the top right corner. We read every message. Happy studying!",
    targetSelector: "[data-tour='profile']",
    ctaLabel: "Start practicing!",
    navigateTo: "/dashboard",
  },
];

const WalktourContext = createContext<{ active: boolean }>({ active: false });
export function useWalktour() {
  return useContext(WalktourContext);
}

export function WalktourProvider({
  children,
  isPro = false,
}: {
  children: React.ReactNode;
  isPro?: boolean;
}) {
  const [step, setStep] = useState<number>(-1);

  useEffect(() => {
    // Runs only on the client after hydration — avoids SSR mismatch
    const timer = setTimeout(() => {
      if (!localStorage.getItem("ltc_tour_done")) setStep(0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (step < 0 || step >= TOUR_STEPS.length) return;
    const selector = TOUR_STEPS[step]?.targetSelector;

    const measure = () => {
      if (!selector) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(selector);
      if (!el) { setTargetRect(null); return; }
      const rect = el.getBoundingClientRect();
      // Element hidden (e.g. sidebar on mobile) — fall back to centered popup
      setTargetRect(rect.width > 0 && rect.height > 0 ? rect : null);
    };

    // If the target is already in the DOM (no navigation pending), measure next tick.
    // Otherwise wait for the page to finish rendering after navigation.
    const alreadyPresent = selector ? !!document.querySelector(selector) : true;
    const timer = setTimeout(measure, alreadyPresent ? 0 : 400);
    return () => clearTimeout(timer);
  }, [step]);

  function next() {
    const current = TOUR_STEPS[step];
    const nextStep = step + 1;
    const dest =
      isPro && current.proNavigateTo
        ? current.proNavigateTo
        : current.navigateTo;
    if (dest) router.push(dest);
    if (nextStep >= TOUR_STEPS.length) {
      dismiss();
    } else {
      setStep(nextStep);
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function dismiss() {
    localStorage.setItem("ltc_tour_done", "1");
    setStep(-1);
    setTargetRect(null);
  }

  const active = step >= 0 && step < TOUR_STEPS.length;
  const current = active ? TOUR_STEPS[step] : null;

  function getPopupStyle(): React.CSSProperties {
    if (!targetRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const popupWidth = Math.min(window.innerWidth * 0.9, 384);
    const padding = 16;
    const centeredLeft = Math.max(
      padding,
      Math.min(
        targetRect.left + targetRect.width / 2 - popupWidth / 2,
        window.innerWidth - popupWidth - padding,
      ),
    );
    const spaceBelow = window.innerHeight - targetRect.bottom - padding;
    if (spaceBelow > 180) {
      return { top: targetRect.bottom + 12, left: centeredLeft };
    }
    return {
      bottom: window.innerHeight - targetRect.top + 12,
      left: centeredLeft,
    };
  }

  return (
    <WalktourContext.Provider value={{ active }}>
      {children}
      {active && current && (
        <>
          {/* Dark backdrop */}
          {!targetRect && (
            <div className="fixed inset-0 z-[200] bg-black/60 pointer-events-none" />
          )}

          {/* Spotlight ring — box-shadow darkens everything outside the target */}
          {targetRect && (
            <div
              className="fixed z-[200] rounded-xl pointer-events-none"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow:
                  "0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 2px var(--success)",
              }}
            />
          )}

          {/* Popup card */}
          <div
            className="fixed z-[201] w-[90vw] max-w-sm rounded-2xl shadow-2xl"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid rgba(255,255,255,0.08)",
              ...getPopupStyle(),
            }}
          >
            {/* Step dots + dismiss */}
            <div className="flex items-center justify-between px-5 pt-4">
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === step ? "18px" : "6px",
                      height: "6px",
                      backgroundColor:
                        i === step
                          ? "var(--success)"
                          : i < step
                            ? "rgba(86,135,109,0.4)"
                            : "rgba(255,255,255,0.15)",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss tour"
                className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:opacity-70 transition-opacity"
                style={{ color: "var(--foreground)" }}
              >
                <FontAwesomeIcon
                  icon={faXmark}
                  style={{ width: "0.875rem", height: "0.875rem" }}
                />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pt-3 pb-5">
              <h3 className="text-base font-semibold mb-2">{current.title}</h3>
              <p
                className="text-sm leading-relaxed mb-5"
                style={{ opacity: 0.6 }}
              >
                {current.body}
              </p>

              <div className="flex items-center justify-between">
                <button
                  onClick={back}
                  className="text-sm cursor-pointer transition-opacity hover:opacity-100"
                  style={{
                    opacity: step === 0 ? 0 : 0.4,
                    pointerEvents: step === 0 ? "none" : "auto",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={next}
                  className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "var(--success)", color: "white" }}
                >
                  {current.ctaLabel ??
                    (step === TOUR_STEPS.length - 1 ? "Done!" : "Next →")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </WalktourContext.Provider>
  );
}
