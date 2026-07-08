"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-regular-svg-icons";

type Problem = {
  id: number;
  title: string;
  difficulty: string;
  note: string | null;
  url: string | null;
  topics: string[];
  patterns: string[];
};

const CONFIDENCE_LABELS: { label: string; value: number }[] = [
  { label: "Forgot", value: 1 },
  { label: "Weak", value: 2 },
  { label: "Okay", value: 3 },
  { label: "Good", value: 4 },
  { label: "Mastered", value: 5 },
];

export default function ReviewPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const ph = usePostHog();
  const [problem, setProblem] = useState<Problem | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().getDate();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchTodaysProblem();
  }, [isLoaded, isSignedIn]);

  async function fetchTodaysProblem() {
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/problems/today`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        setError(`Request failed: ${res.status}`);
        return;
      }
      setProblem(await res.json());
      setExpanded(false);
    } catch (e) {
      setError(String(e));
    }
  }

  async function submitReview(confidence: number) {
    if (!problem || submitting) return;
    setSubmitting(true);
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/problems/${problem.id}/review`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confidence }),
      },
    );
    if (!res.ok) {
      setError(`Request failed: ${res.status}`);
      setSubmitting(false);
      return;
    }
    ph?.capture("review_submitted", {
      confidence,
      problem_title: problem.title,
      difficulty: problem.difficulty,
    });
    await fetchTodaysProblem();
    setSubmitting(false);
  }

  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (problem === undefined)
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
        <div className="rounded-xl border border-foreground/10 p-6">
          <div className="h-4 w-14 rounded bg-foreground/10 animate-pulse mx-auto mb-4" />
          <div className="h-6 w-2/3 rounded bg-foreground/10 animate-pulse mx-auto" />
        </div>
        <div className="mt-6">
          <div className="h-4 w-28 rounded bg-foreground/10 animate-pulse mb-3" />
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 w-20 rounded-full bg-foreground/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );

  if (problem === null) {
    return (
      <div className="p-8 max-w-2xl mx-auto w-full flex flex-col items-center gap-6 py-24 text-center">
        <FontAwesomeIcon
          icon={faCalendarDays}
          style={{
            width: "3rem",
            height: "3rem",
            color: "var(--success)",
            opacity: 0.4,
          }}
        />
        <h1 className="text-2xl font-semibold">No Problems for Today</h1>
        <p className="text-foreground/60">
          You&apos;re all caught up! Ready to practice something new?
        </p>
        <a
          href="/dashboard"
          className="rounded-full bg-primary text-primary-foreground font-medium text-base h-12 px-8 flex items-center transition-opacity hover:opacity-90"
        >
          Practice a New One
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left rounded-xl border border-foreground/10 p-6 cursor-pointer hover:border-foreground/20 transition-colors"
      >
        <div className="relative flex justify-center items-start mb-4">
          <span className="absolute left-0 w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
            {today}
          </span>
          <span className="text-sm font-medium text-foreground/50">Today</span>
        </div>
        <h1 className="text-xl font-semibold text-center">{problem.title}</h1>
        {expanded && (
          <div className="mt-4 flex flex-col gap-3 border-t border-foreground/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {problem.difficulty}
            </p>
            <p className="text-sm text-foreground/60">
              {problem.topics.join(", ")} · {problem.patterns.join(", ")}
            </p>
            {problem.note && (
              <p className="text-sm italic text-foreground/50">
                {problem.note}
              </p>
            )}
            {problem.url && (
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View problem ↗
              </a>
            )}
          </div>
        )}
      </button>

      <div className="mt-6">
        <p className="text-sm font-medium mb-3">How did it go?</p>
        <div className="flex gap-2 flex-wrap">
          {CONFIDENCE_LABELS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => submitReview(value)}
              disabled={submitting}
              className="rounded-full border border-foreground/20 px-5 h-10 text-sm font-medium cursor-pointer transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
