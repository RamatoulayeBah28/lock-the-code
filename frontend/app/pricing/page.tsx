"use client";

import { useAuth, SignUpButton } from "@clerk/nextjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";

const FREE_FEATURES = [
  "Unlimited problem tracking",
  "SM-2 spaced repetition review queue",
  "Topics & patterns tagging",
  "Edit & delete problems",
  "Calendar sync",
];

const PRO_FEATURES = [
  "Everything in Free",
  "AI Tutor mode — Socratic hints while solving",
  "AI Interviewer mode — mock interview to practice any problem",
  "Unlimited flashcard decks",
];

const PLANS = [
  {
    id: "trial",
    name: "Free Trial",
    price: "$0",
    interval: "for 7 days, then $7.99/mo",
    badge: "Most popular",
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    id: "annual",
    name: "Annual",
    price: "$79",
    interval: "per year · ~$6.67/mo",
    badge: "Best value",
    cta: "Get Annual",
    highlight: false,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "$149",
    interval: "one-time · launch price",
    badge: "Limited offer",
    cta: "Get Lifetime Access",
    highlight: false,
  },
];

export default function PricingPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const ph = usePostHog();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialModal, setTrialModal] = useState(false);

  async function checkout(plan: string) {
    ph?.capture("upgrade_clicked", { source: "pricing_page", plan });
    setLoading(plan);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail: string = body?.detail ?? "";
        if (detail.toLowerCase().includes("trial")) {
          setTrialModal(true);
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }
      const { url } = await res.json();
      router.push(url);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {trialModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setTrialModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-5"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Trial already used</h2>
              <p
                className="text-sm"
                style={{ color: "var(--foreground)", opacity: 0.6 }}
              >
                You&apos;ve already used your 7-day free trial. Choose a plan to
                keep your Pro features.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setTrialModal(false);
                  checkout("annual");
                }}
                disabled={loading !== null}
                className="rounded-full font-medium text-sm h-10 px-6 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: "var(--foreground)",
                  color: "var(--surface)",
                }}
              >
                {loading === "annual"
                  ? "Redirecting..."
                  : "Get Annual — $79/yr"}
              </button>
              <button
                onClick={() => {
                  setTrialModal(false);
                  checkout("lifetime");
                }}
                disabled={loading !== null}
                className="rounded-full border font-medium text-sm h-10 px-6 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ borderColor: "var(--foreground)", opacity: 0.7 }}
              >
                {loading === "lifetime"
                  ? "Redirecting..."
                  : "Get Lifetime — $149"}
              </button>
              <button
                onClick={() => setTrialModal(false)}
                className="text-sm text-center cursor-pointer hover:opacity-70 transition-opacity"
                style={{ color: "var(--foreground)", opacity: 0.4 }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="px-4 py-6 sm:p-8 max-w-5xl mx-auto w-full">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold mb-3">
            Lock in your interview prep
          </h1>
          <p className="text-foreground/60 text-lg">
            The core review queue is always free. Pro unlocks AI-powered
            practice.
          </p>
        </div>

        {error && <p className="text-center text-red-600 mb-6">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          {/* Free tier */}
          <div className="rounded-xl border border-foreground/10 p-6 flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/40 mb-1">
                Free
              </p>
              <p className="text-3xl font-semibold">$0</p>
              <p className="text-sm text-foreground/50">forever</p>
            </div>
            <ul className="flex flex-col gap-2 flex-1">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-foreground/70"
                >
                  <FontAwesomeIcon
                    icon={faCheck}
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "var(--success)",
                      marginTop: "0.125rem",
                      flexShrink: 0,
                    }}
                  />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="/dashboard"
              className="rounded-full border border-foreground/20 text-foreground/60 font-medium text-sm h-10 px-6 flex items-center justify-center hover:opacity-70 transition-opacity"
            >
              Continue Free
            </a>
          </div>

          {/* Pro plans */}
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 flex flex-col gap-4 ${
                plan.highlight
                  ? "border-primary bg-primary/5"
                  : "border-foreground/10"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
                    {plan.name}
                  </p>
                  <span className="text-xs bg-accent/30 text-foreground/70 font-medium px-2 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                </div>
                <p className="text-3xl font-semibold">{plan.price}</p>
                <p className="text-sm text-foreground/50">{plan.interval}</p>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-foreground/70"
                  >
                    <FontAwesomeIcon
                      icon={faCheck}
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: "var(--success)",
                        marginTop: "0.125rem",
                        flexShrink: 0,
                      }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              {isLoaded && isSignedIn ? (
                <button
                  onClick={() => checkout(plan.id)}
                  disabled={loading !== null}
                  className={`rounded-full font-medium text-sm h-10 px-6 cursor-pointer transition-opacity hover:opacity-90 ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground"
                      : "border border-foreground/20 text-foreground"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan.id ? "Redirecting..." : plan.cta}
                </button>
              ) : (
                <SignUpButton forceRedirectUrl="/pricing">
                  <button
                    className={`rounded-full font-medium text-sm h-10 px-6 cursor-pointer transition-opacity hover:opacity-90 ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground"
                        : "border border-foreground/20 text-foreground"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </SignUpButton>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
