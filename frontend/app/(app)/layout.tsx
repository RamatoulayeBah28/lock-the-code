"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, LayoutDashboard, Bot, Mic, Layers } from "lucide-react";

type ProStatus = { is_pro: boolean } | null;

const FREE_ITEMS = [
  { href: "/review", label: "Review Queue", icon: CalendarCheck },
  { href: "/dashboard", label: "My Problems", icon: LayoutDashboard },
];

const PRO_ITEMS = [
  { href: "/chat/tutor", label: "Ask Your AI Tutor", icon: Bot },
  { href: "/chat/interview", label: "Simulate a Real Interview", icon: Mic },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [proStatus, setProStatus] = useState<ProStatus>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function fetchMe() {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setProStatus(await res.json());
    }
    fetchMe();
  }, [isLoaded, isSignedIn, getToken]);

  function handleProClick(href: string) {
    if (!proStatus?.is_pro) {
      router.push("/pricing");
      return;
    }
    router.push(href);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <nav
        className="w-60 shrink-0 flex flex-col gap-1 py-6 px-3 overflow-y-auto"
        style={{ backgroundColor: "var(--foreground)" }}
      >
        {/* Free nav items */}
        <p
          className="text-xs font-semibold uppercase tracking-widest px-3 mb-2"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Practice
        </p>
        {FREE_ITEMS.map(({ href, label, icon: Icon }) => {
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
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--success)" }}
              />
              {label}
            </button>
          );
        })}

        {/* Divider */}
        <div
          className="my-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        />

        {/* Pro nav items */}
        <p
          className="text-xs font-semibold uppercase tracking-widest px-3 mb-2 flex items-center gap-2"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Lock In
        </p>
        {PRO_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => handleProClick(href)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full transition-colors cursor-pointer"
              style={{
                backgroundColor: active ? "rgba(252,185,125,0.2)" : "transparent",
                color: active ? "var(--accent)" : "rgba(255,255,255,0.75)",
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--accent)" }}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
