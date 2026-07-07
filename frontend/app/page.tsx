"use client";

import { useAuth, SignUpButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
const LOGOS = [
  { src: "/leetcode.png",       alt: "LeetCode" },
  { src: "/neetcode.png",       alt: "NeetCode" },
  { src: "/codesignal.png",     alt: "CodeSignal" },
  { src: "/hackerrank.png",     alt: "HackerRank" },
  { src: "/hello.png",          alt: "HelloInterview" },
  { src: "/pramp.png",          alt: "Pramp" },
  { src: "/interviewingio.png", alt: "Interviewing.io", className: "h-20" },
];

const NAV_ITEMS = [
  "Review Queue",
  "My Problems",
  "AI Tutor",
  "Interview",
  "Flashcards",
];

function BrowserMockup() {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div
      className="animate-float w-full rounded-2xl overflow-hidden"
      style={{
        boxShadow:
          "0 30px 80px rgba(49,54,40,0.20), 0 8px 24px rgba(49,54,40,0.12)",
        transformOrigin: "center top",
        maxWidth: "640px",
      }}
    >
      {/* Chrome bar */}
      <div
        className="flex items-center gap-1.5 h-10 px-4 shrink-0"
        style={{ background: "var(--foreground)" }}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "#FF5F57" }}
        />
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "#FFBD2E" }}
        />
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "#28C840" }}
        />
        <div
          className="mx-4 flex-1 h-6 rounded flex items-center px-3 text-xs"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.40)",
          }}
        >
          lockthecode.net/review
        </div>
      </div>

      {/* Video (primary) */}
      {!videoFailed ? (
        <video
          src="/demo.mp4"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
          style={{ width: "100%", display: "block" }}
        />
      ) : (
        /* CSS mockup fallback if video fails */
        <div
          className="flex"
          style={{ height: "340px", background: "var(--surface)" }}
        >
          <div
            className="hidden sm:flex w-44 shrink-0 flex-col gap-1 py-5 px-2"
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
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{
                    background:
                      i === 0 ? "var(--success)" : "rgba(255,255,255,0.2)",
                  }}
                />
                {item}
              </div>
            ))}
            <div
              className="my-2 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            />
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
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: "rgba(252,185,125,0.3)" }}
                />
                {item}
              </div>
            ))}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
            <div
              className="w-full max-w-xs rounded-2xl border p-5 flex flex-col gap-3"
              style={{ borderColor: "rgba(49,54,40,0.10)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-0.5"
                  style={{
                    background: "rgba(86,135,109,0.12)",
                    color: "var(--success)",
                  }}
                >
                  Medium
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: "rgba(49,54,40,0.35)" }}
                >
                  Due today
                </span>
              </div>
              <div
                className="h-4 w-40 rounded"
                style={{ background: "rgba(49,54,40,0.10)" }}
              />
              <div className="flex gap-2 flex-wrap">
                {[72, 60, 56, 48, 56].map((w, i) => (
                  <div
                    key={i}
                    className="h-9 rounded-full"
                    style={{
                      width: w,
                      background:
                        i === 2 ? "var(--primary)" : "rgba(49,54,40,0.07)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
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
      {/* Hero — two columns on large screens */}
      <main className="flex flex-1 w-full max-w-7xl flex-col lg:flex-row items-center gap-10 lg:gap-16 px-8 pt-8 pb-16">
        {/* Left: text + CTAs */}
        <div className="flex flex-col items-center lg:items-start gap-7 flex-1 text-center lg:text-left">
          <Image
            src="/lock-the-code-logo.png"
            alt="Lock The Code"
            width={340}
            height={220}
            className="object-contain w-full max-w-[340px]"
          />
          <h1 className="max-w-lg text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-foreground">
            The Only Free Technical Interview Study Plan You Need
          </h1>
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
        </div>

        {/* Right: floating browser with video */}
        <div className="flex-1 w-full flex justify-center lg:justify-end">
          <BrowserMockup />
        </div>
      </main>

      {/* Logo marquee — full bleed */}
      <div className="w-full pb-16">
        <p
          className="text-center text-sm font-medium mb-8"
          style={{ color: "rgba(49,54,40,0.40)" }}
        >
          Works alongside the resources you already use
        </p>
        <div className="overflow-hidden w-full">
          <div
            className="animate-marquee flex gap-20 items-center"
            style={{ width: "max-content" }}
          >
            {[...LOGOS, ...LOGOS].map((logo, i) => (
              <Image
                key={i}
                src={logo.src}
                alt={logo.alt}
                width={120}
                height={48}
                className={`${logo.className ?? "h-8"} w-auto object-contain select-none`}
                draggable={false}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Features section */}
      <section className="w-full max-w-7xl px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-4">
            Everything you need to land the job
          </h2>
          <p className="text-lg text-foreground/60 max-w-xl mx-auto">
            Lock The Code combines the tools that actually move the needle —
            so you practice smarter, not longer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6 flex flex-col gap-3 border"
              style={{ borderColor: "rgba(49,54,40,0.08)", background: "rgba(49,54,40,0.02)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: f.iconBg }}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-base text-foreground">{f.title}</h3>
              <p className="text-sm leading-6 text-foreground/60">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

const FEATURES = [
  {
    icon: "🔁",
    iconBg: "rgba(86,135,109,0.12)",
    title: "Spaced-Repetition Reviews",
    description:
      "Problems resurface right before you'd forget them, powered by the SM-2 algorithm. Build lasting memory instead of cramming the night before.",
  },
  {
    icon: "🤖",
    iconBg: "rgba(252,185,125,0.20)",
    title: "AI Interview Simulator",
    description:
      "Face a realistic mock interviewer that asks follow-ups, pushes on your reasoning, and grades your performance — all without needing to book a peer session.",
  },
  {
    icon: "💡",
    iconBg: "rgba(162,0,33,0.08)",
    title: "AI Tutor",
    description:
      "Stuck on a problem? The tutor gives Socratic hints that guide your thinking without handing you the answer — the way real learning works.",
  },
  {
    icon: "📋",
    iconBg: "rgba(49,54,40,0.06)",
    title: "Problem Tracker",
    description:
      "Log every problem you solve with difficulty, topics, patterns, and personal notes. Your entire prep history in one place, always searchable.",
  },
  {
    icon: "🃏",
    iconBg: "rgba(252,185,125,0.20)",
    title: "Algorithm Flashcards",
    description:
      "Lock in the patterns that show up again and again — sliding window, two pointers, dynamic programming — with spaced-repetition flashcards.",
  },
  {
    icon: "📅",
    iconBg: "rgba(86,135,109,0.12)",
    title: "Daily Review Queue",
    description:
      "Wake up to a personalised queue of exactly what's due today. No guessing, no overwhelm — just the right problems at the right time.",
  },
];
