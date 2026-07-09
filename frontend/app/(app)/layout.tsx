"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PaywallModal from "@/app/components/PaywallModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarCheck,
  faList,
  faRobot,
  faMicrophone,
  faLayerGroup,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

type ProStatus = { is_pro: boolean } | null;

const FREE_ITEMS: {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconDefinition;
}[] = [
  {
    href: "/review",
    label: "Review Queue",
    shortLabel: "Review",
    icon: faCalendarCheck,
  },
  {
    href: "/dashboard",
    label: "My Problems",
    shortLabel: "Problems",
    icon: faList,
  },

  {
    href: "/flashcards",
    label: "Flashcards",
    shortLabel: "Flashcards",
    icon: faLayerGroup,
  },
];

const PRO_ITEMS: {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconDefinition;
}[] = [
  {
    href: "/chat/tutor",
    label: "Ask Your AI Tutor",
    shortLabel: "Tutor",
    icon: faRobot,
  },
  {
    href: "/chat/interview",
    label: "Simulate a Real Interview",
    shortLabel: "Interview",
    icon: faMicrophone,
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [proStatus, setProStatus] = useState<ProStatus>(null);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const [leaveConfirmHref, setLeaveConfirmHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!leaveConfirmHref) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLeaveConfirmHref(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leaveConfirmHref]);

  // Chat pages fill the viewport — hide the bottom nav so it doesn't overlay the input bar
  const isChatPage = pathname.startsWith("/chat/");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function fetchMe() {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setProStatus(await res.json());
      } catch {}
    }
    fetchMe();
  }, [isLoaded, isSignedIn, getToken]);

  function safeNavigate(href: string) {
    if (
      pathname === "/chat/interview" &&
      href !== "/chat/interview" &&
      sessionStorage.getItem("ltc_interview_running") === "1"
    ) {
      setLeaveConfirmHref(href);
      return;
    }
    router.push(href);
  }

  function handleProClick(href: string, label: string) {
    if (!proStatus?.is_pro) {
      setPaywallFeature(label);
      return;
    }
    safeNavigate(href);
  }

  return (
    <div
      className={`flex overflow-hidden ${isChatPage ? "h-[calc(100dvh-4rem)]" : "flex-1"}`}
    >
      {/* Sidebar — md+ only */}
      <nav
        className="hidden md:flex w-60 shrink-0 flex-col gap-1 py-6 px-3 overflow-y-auto"
        style={{ backgroundColor: "var(--foreground)" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest px-3 mb-2"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Practice
        </p>
        {FREE_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => safeNavigate(href)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full transition-colors cursor-pointer"
              style={{
                backgroundColor: active
                  ? "rgba(86,135,109,0.25)"
                  : "transparent",
                color: active ? "var(--success)" : "rgba(255,255,255,0.75)",
              }}
            >
              <FontAwesomeIcon
                icon={icon}
                style={{
                  color: "var(--success)",
                  width: "1rem",
                  height: "1rem",
                }}
              />
              {label}
            </button>
          );
        })}

        <div
          className="my-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        />

        <p
          className="text-xs font-semibold uppercase tracking-widest px-3 mb-2"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Lock In
        </p>
        {PRO_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => handleProClick(href, label)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full transition-colors cursor-pointer"
              style={{
                backgroundColor: active
                  ? "rgba(252,185,125,0.2)"
                  : "transparent",
                color: active ? "var(--accent)" : "rgba(255,255,255,0.75)",
              }}
            >
              <FontAwesomeIcon
                icon={icon}
                style={{
                  color: "var(--accent)",
                  width: "1rem",
                  height: "1rem",
                }}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Main content — extra bottom padding on mobile so content clears the fixed bottom nav */}
      <main
        className={`flex-1 md:pb-0 ${isChatPage ? "overflow-hidden" : "overflow-y-auto pb-16"}`}
      >
        {children}
      </main>

      {/* Bottom nav — mobile only, hidden on chat pages */}
      {!isChatPage && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex h-14 border-t border-foreground/10 z-40"
          style={{ backgroundColor: "var(--surface)" }}
        >
          {FREE_ITEMS.map(({ href, shortLabel, icon }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                onClick={() => safeNavigate(href)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                style={{ opacity: active ? 1 : 0.4 }}
              >
                <FontAwesomeIcon
                  icon={icon}
                  style={{
                    color: "var(--success)",
                    width: "1.125rem",
                    height: "1.125rem",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--success)" }}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
          {PRO_ITEMS.map(({ href, label, shortLabel, icon }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                onClick={() => handleProClick(href, label)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                style={{ opacity: active ? 1 : 0.4 }}
              >
                <FontAwesomeIcon
                  icon={icon}
                  style={{
                    color: "var(--accent)",
                    width: "1.125rem",
                    height: "1.125rem",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </nav>
      )}
      {paywallFeature && (
        <PaywallModal
          featureLabel={paywallFeature}
          onClose={() => setPaywallFeature(null)}
        />
      )}
      {leaveConfirmHref && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setLeaveConfirmHref(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-5"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Interview in progress</h2>
              <p className="text-sm text-foreground/60">
                Your interview is still running. You can return within 1 minute
                to continue where you left off.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveConfirmHref(null)}
                className="flex-1 rounded-full border border-foreground/20 text-sm font-medium py-2.5 cursor-pointer hover:border-foreground/40 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  router.push(leaveConfirmHref);
                  setLeaveConfirmHref(null);
                }}
                className="flex-1 rounded-full bg-primary text-primary-foreground text-sm font-medium py-2.5 cursor-pointer hover:opacity-90 transition-opacity"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
