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
  faGear,
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
  {
    href: "/flashcards",
    label: "Flashcards",
    shortLabel: "Flashcards",
    icon: faLayerGroup,
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [proStatus, setProStatus] = useState<ProStatus>(null);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

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

  function handleProClick(href: string, label: string) {
    if (!proStatus?.is_pro) {
      setPaywallFeature(label);
      return;
    }
    router.push(href);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
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
              onClick={() => router.push(href)}
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

        <div className="mt-auto pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full transition-colors cursor-pointer"
            style={{
              backgroundColor: pathname === "/settings" ? "rgba(255,255,255,0.08)" : "transparent",
              color: pathname === "/settings" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.55)",
            }}
          >
            <FontAwesomeIcon
              icon={faGear}
              style={{ color: "rgba(255,255,255,0.55)", width: "1rem", height: "1rem" }}
            />
            Settings
          </button>
        </div>
      </nav>

      {/* Main content — extra bottom padding on mobile so content clears the fixed bottom nav */}
      <main
        className={`flex-1 overflow-y-auto md:pb-0 ${isChatPage ? "" : "pb-16"}`}
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
                onClick={() => router.push(href)}
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
          <button
            onClick={() => router.push("/settings")}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            style={{ opacity: pathname === "/settings" ? 1 : 0.4 }}
          >
            <FontAwesomeIcon
              icon={faGear}
              style={{ color: "var(--foreground)", width: "1.125rem", height: "1.125rem" }}
            />
            <span className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>
              Settings
            </span>
          </button>
        </nav>
      )}
      {paywallFeature && (
        <PaywallModal
          featureLabel={paywallFeature}
          onClose={() => setPaywallFeature(null)}
        />
      )}
    </div>
  );
}
