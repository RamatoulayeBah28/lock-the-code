"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

type Flashcard = {
  id?: number;
  front: string;
  back: string;
  pattern?: string;
};

type Status = "loading" | "paywall" | "empty" | "reviewing" | "done";

export default function FlashcardsPage() {
  const { getToken } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/flashcards`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.status === 402) {
          setStatus("paywall");
          return;
        }
        if (!res.ok) {
          setStatus("empty");
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setStatus("empty");
            return;
          }
          setCards(data);
          setIsFreePreview(false);
        } else {
          if (!data) {
            setStatus("empty");
            return;
          }
          setCards([data]);
          setIsFreePreview(true);
        }
        setStatus("reviewing");
      } catch {
        setStatus("empty");
      }
    }
    load();
  }, [getToken]);

  async function submitReview(correct: boolean) {
    if (submitting) return;
    const card = cards[index];
    if (!card.id) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/flashcards/${card.id}/review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ correct }),
        },
      );
    } catch {}
    setStats((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    }));
    setSubmitting(false);
    if (index + 1 >= cards.length) {
      setStatus("done");
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  function restart() {
    setIndex(0);
    setFlipped(false);
    setStats({ correct: 0, wrong: 0 });
    setStatus("reviewing");
  }

  const card = cards[index];

  if (status === "loading")
    return (
      <div className="flex-1 flex items-center justify-center">
        <p
          className="text-sm"
          style={{ color: "var(--foreground)", opacity: 0.35 }}
        >
          Loading flashcards...
        </p>
      </div>
    );

  if (status === "paywall")
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center flex flex-col items-center gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "var(--accent)", opacity: 0.15 }}
          >
            <FontAwesomeIcon
              icon={faLayerGroup}
              style={{
                width: "1.5rem",
                height: "1.5rem",
                color: "var(--accent)",
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Flashcards are Pro</h2>
            <p
              className="text-sm"
              style={{ color: "var(--foreground)", opacity: 0.55 }}
            >
              You&apos;ve used your free preview. Upgrade to review all 22
              algorithm patterns with spaced repetition.
            </p>
          </div>
          <Link
            href="/pricing"
            className="rounded-full h-10 px-6 flex items-center justify-center font-medium text-sm hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: "var(--foreground)",
              color: "var(--surface)",
            }}
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    );

  if (status === "empty")
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center flex flex-col items-center gap-4 mt-10">
          <FontAwesomeIcon
            icon={faLayerGroup}
            style={{ width: "2rem", height: "2rem", color: "var(--accent)" }}
          />
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">All caught up!</h2>
            <p
              className="text-sm"
              style={{ color: "var(--foreground)", opacity: 0.55 }}
            >
              No flashcards are due right now. Come back later.
            </p>
          </div>
        </div>
      </div>
    );

  if (status === "done")
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Session complete</h2>
            <p
              className="text-sm"
              style={{ color: "var(--foreground)", opacity: 0.5 }}
            >
              {cards.length} card{cards.length !== 1 ? "s" : ""} reviewed
            </p>
          </div>
          <div className="flex gap-10">
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-3xl font-semibold"
                style={{ color: "var(--success)" }}
              >
                {stats.correct}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--foreground)", opacity: 0.45 }}
              >
                Got it
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-3xl font-semibold"
                style={{ color: "#a20021" }}
              >
                {stats.wrong}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--foreground)", opacity: 0.45 }}
              >
                Wrong
              </span>
            </div>
          </div>
          <button
            onClick={restart}
            className="rounded-full border h-10 px-6 text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer"
            style={{ borderColor: "rgba(49,54,40,0.2)" }}
          >
            Review again
          </button>
        </div>
      </div>
    );

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FontAwesomeIcon
            icon={faLayerGroup}
            style={{
              width: "1.1rem",
              height: "1.1rem",
              color: "var(--accent)",
            }}
          />
          <h1 className="text-lg font-semibold">Flashcards</h1>
        </div>
        {!isFreePreview && (
          <span
            className="text-sm tabular-nums"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            {index + 1} / {cards.length}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!isFreePreview && (
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(49,54,40,0.1)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(index / cards.length) * 100}%`,
              backgroundColor: "var(--accent)",
            }}
          />
        </div>
      )}

      {/* Flip card */}
      <div style={{ perspective: "1200px" }}>
        <div
          onClick={() => !flipped && setFlipped(true)}
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.45s ease",
            position: "relative",
            minHeight: "280px",
            cursor: flipped ? "default" : "pointer",
          }}
        >
          {/* Front */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              position: "absolute",
              inset: 0,
              borderRadius: "1rem",
              border: "1px solid rgba(49,54,40,0.12)",
              backgroundColor: "var(--surface)",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              What pattern is this?
            </p>
            <p
              className="text-base leading-relaxed flex-1"
              style={{ color: "var(--foreground)" }}
            >
              {card.front}
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--foreground)", opacity: 0.3 }}
            >
              Tap to reveal
            </p>
          </div>

          {/* Back */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: "absolute",
              inset: 0,
              borderRadius: "1rem",
              border: "1px solid rgba(49,54,40,0.12)",
              backgroundColor: "var(--surface)",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {card.pattern && (
              <span
                className="text-xs font-semibold uppercase tracking-widest self-start px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "var(--accent)", color: "#313628" }}
              >
                {card.pattern}
              </span>
            )}
            <p
              className="text-base leading-relaxed flex-1"
              style={{ color: "var(--foreground)" }}
            >
              {card.back}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {flipped &&
        (isFreePreview ? (
          <div className="flex flex-col items-center gap-3 text-center pt-2">
            <p
              className="text-sm"
              style={{ color: "var(--foreground)", opacity: 0.55 }}
            >
              That was your free card. Upgrade to Pro for all 22 patterns with
              spaced repetition.
            </p>
            <Link
              href="/pricing"
              className="rounded-full h-10 px-6 flex items-center justify-center font-medium text-sm hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: "var(--foreground)",
                color: "var(--surface)",
              }}
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => submitReview(false)}
              disabled={submitting}
              className="flex-1 rounded-full h-11 flex items-center justify-center gap-2 font-medium text-sm border cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
              style={{ borderColor: "#a20021", color: "#a20021" }}
            >
              <FontAwesomeIcon
                icon={faXmark}
                style={{ width: "1rem", height: "1rem" }}
              />
              Wrong
            </button>
            <button
              onClick={() => submitReview(true)}
              disabled={submitting}
              className="flex-1 rounded-full h-11 flex items-center justify-center gap-2 font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--success)", color: "white" }}
            >
              <FontAwesomeIcon
                icon={faCheck}
                style={{ width: "1rem", height: "1rem" }}
              />
              Got it
            </button>
          </div>
        ))}
    </div>
  );
}
