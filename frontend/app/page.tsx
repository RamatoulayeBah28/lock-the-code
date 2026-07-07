"use client";

import { useAuth, SignUpButton } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const LOGOS = [
  { name: "LeetCode",       color: "#FFA116" },
  { name: "NeetCode",       color: "#0EA5E9" },
  { name: "CodeSignal",     color: "#2F80ED" },
  { name: "HackerRank",     color: "#00EA64" },
  { name: "W3Schools",      color: "#04AA6D" },
  { name: "Educative.io",   color: "#FF6B35" },
  { name: "HelloInterview", color: "#7C3AED" },
  { name: "AlgoExpert",     color: "#E53E3E" },
];

const NAV_ITEMS = ["Review Queue", "My Problems", "AI Tutor", "Interview", "Flashcards"];

function BrowserMockup() {
  return (
    <div
      className="animate-float w-full max-w-3xl rounded-2xl overflow-hidden"
      style={{
        boxShadow: "0 30px 80px rgba(49,54,40,0.20), 0 8px 24px rgba(49,54,40,0.12)",
        transformOrigin: "center top",
      }}
    >
      {/* Chrome bar */}
      <div
        className="flex items-center gap-1.5 h-10 px-4 shrink-0"
        style={{ background: "var(--foreground)" }}
      >
        <span className="w-3 h-3 rounded-full" style={{ background: "#FF5F57" }} />
        <span className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
        <span className="w-3 h-3 rounded-full" style={{ background: "#28C840" }} />
        <div
          className="mx-4 flex-1 h-6 rounded flex items-center px-3 text-xs"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}
        >
          lockthecode.net/review
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: "340px", background: "var(--surface)" }}>
        {/* Sidebar */}
        <div
          className="hidden sm:flex w-48 shrink-0 flex-col gap-1 py-5 px-2"
          style={{ background: "var(--foreground)" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            Practice
          </p>
          {NAV_ITEMS.slice(0, 2).map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: i === 0 ? "rgba(86,135,109,0.22)" : "transparent",
                color: i === 0 ? "var(--success)" : "rgba(255,255,255,0.45)",
              }}
            >
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                style={{ background: i === 0 ? "var(--success)" : "rgba(255,255,255,0.2)" }}
              />
              {item}
            </div>
          ))}
          <div className="my-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            Lock In
          </p>
          {NAV_ITEMS.slice(2).map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                style={{ background: "rgba(252,185,125,0.3)" }}
              />
              {item}
            </div>
          ))}
        </div>

        {/* Main pane — looks like the Review Queue page */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="w-full max-w-sm flex flex-col gap-3">
            {/* Problem card */}
            <div
              className="rounded-2xl border p-5 flex flex-col gap-3"
              style={{ borderColor: "rgba(49,54,40,0.10)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-0.5"
                  style={{ background: "rgba(86,135,109,0.12)", color: "var(--success)" }}
                >
                  Medium
                </span>
                <span className="text-[11px]" style={{ color: "rgba(49,54,40,0.35)" }}>Due today</span>
              </div>
              <div className="h-4 w-44 rounded" style={{ background: "rgba(49,54,40,0.10)" }} />
              <div className="flex gap-2 mt-1 flex-wrap">
                {[72, 60, 56, 48, 56].map((w, i) => (
                  <div
                    key={i}
                    className="h-9 rounded-full"
                    style={{ width: w, background: i === 2 ? "var(--primary)" : "rgba(49,54,40,0.07)" }}
                  />
                ))}
              </div>
            </div>

            {/* Streak / stats row */}
            <div className="flex gap-3">
              {["🔥 12-day streak", "47 problems solved"].map((label) => (
                <div
                  key={label}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-medium"
                  style={{ background: "rgba(49,54,40,0.05)", color: "rgba(49,54,40,0.55)" }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Real video overlay — drop demo.mp4 into /public to activate */}
      <video
        src="/demo.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="hidden"
        onCanPlay={(e) => {
          const vid = e.currentTarget;
          vid.classList.remove("hidden");
          vid.previousElementSibling?.classList.add("hidden");
        }}
        style={{ width: "100%", display: "none" }}
      />
    </div>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/review");
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="flex flex-col flex-1 items-center font-sans overflow-x-hidden">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-start gap-10 pt-4 pb-16 px-6 text-center">
        {/* Hero */}
        <div className="flex flex-col items-center">
          <Image
            src="/lock-the-code-logo.png"
            alt="Lock The Code"
            width={400}
            height={260}
            className="object-contain w-full max-w-[400px]"
          />
          <h1 className="max-w-xl text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-foreground">
            The Only Free Technical Interview Study Plan You Need
          </h1>
        </div>

        <p className="max-w-md text-lg leading-7 text-foreground/70">
          Track every problem you solve, review it before you forget it, and
          walk into your next interview ready.
        </p>

        <div className="flex items-center gap-3">
          <SignUpButton forceRedirectUrl="/review">
            <button className="rounded-full bg-primary text-primary-foreground font-medium text-base h-12 px-8 cursor-pointer transition-opacity hover:opacity-90">
              Start Free
            </button>
          </SignUpButton>
          <a
            href="/pricing"
            className="rounded-full border border-foreground/20 text-foreground font-medium text-base h-12 px-8 flex items-center transition-opacity hover:opacity-70"
          >
            Get Pro
          </a>
        </div>

        {/* Floating demo */}
        <div className="w-full flex justify-center pt-2">
          <BrowserMockup />
        </div>
      </main>

      {/* Logo marquee — full bleed below max-w container */}
      <div className="w-full pb-16">
        <p className="text-center text-sm font-medium mb-6" style={{ color: "rgba(49,54,40,0.40)" }}>
          Works alongside the resources you already use
        </p>
        <div className="overflow-hidden w-full">
          <div
            className="animate-marquee flex gap-16 items-center"
            style={{ width: "max-content" }}
          >
            {[...LOGOS, ...LOGOS].map((logo, i) => (
              <span
                key={i}
                className="text-base font-semibold whitespace-nowrap select-none"
                style={{ color: logo.color, opacity: 0.85 }}
              >
                {logo.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
