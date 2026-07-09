"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faCheck,
  faXmark,
  faPlus,
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import PaywallModal from "@/app/components/PaywallModal";

type Flashcard = { id?: number; front: string; back: string; pattern?: string };
type View = "decks" | "session";
type SessionStatus = "loading" | "reviewing" | "done";

export default function FlashcardsPage() {
  const { getToken } = useAuth();
  const [view, setView] = useState<View>("decks");
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [paywallModal, setPaywallModal] = useState(false);

  useEffect(() => {
    async function checkPro() {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIsPro(data.is_pro);
        }
      } catch {}
    }
    checkPro();
  }, [getToken]);

  // Spacebar toggles flip during review
  useEffect(() => {
    if (view !== "session" || sessionStatus !== "reviewing") return;
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, sessionStatus]);

  async function startDeck() {
    setView("session");
    setSessionStatus("loading");
    setIndex(0);
    setFlipped(false);
    setStats({ correct: 0, wrong: 0 });
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 402) {
        setView("decks");
        setPaywallModal(true);
        return;
      }
      if (!res.ok) {
        setSessionStatus("done");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length === 0) { setSessionStatus("done"); return; }
        setCards(data);
        setIsFreePreview(false);
      } else {
        if (!data) { setSessionStatus("done"); return; }
        setCards([data]);
        setIsFreePreview(true);
      }
      setSessionStatus("reviewing");
    } catch {
      setSessionStatus("done");
    }
  }

  async function submitReview(correct: boolean) {
    // Free preview: don't hit the API, just show paywall
    if (isFreePreview) {
      setPaywallModal(true);
      return;
    }
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
      setSessionStatus("done");
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  const card = cards[index];

  // ── DECKS VIEW ────────────────────────────────────────────────────────────
  if (view === "decks") return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2.5 mb-8">
        <FontAwesomeIcon
          icon={faLayerGroup}
          style={{ width: "1.1rem", height: "1.1rem", color: "var(--accent)" }}
        />
        <h1 className="text-lg font-semibold">Flashcards</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        {/* System deck */}
        <button
          onClick={startDeck}
          className="rounded-2xl border p-5 flex flex-col gap-3 text-left hover:opacity-80 transition-opacity cursor-pointer"
          style={{
            borderColor: "rgba(49,54,40,0.15)",
            backgroundColor: "var(--surface)",
            width: "176px",
            height: "176px",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <FontAwesomeIcon
              icon={faLayerGroup}
              style={{ width: "1rem", height: "1rem", color: "#313628" }}
            />
          </div>
          <div>
            <p className="font-semibold text-sm">Interview Patterns</p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--foreground)", opacity: 0.45 }}
            >
              22 cards
            </p>
          </div>
        </button>

        {/* New deck */}
        <button
          onClick={() => {
            if (!isPro) { setPaywallModal(true); return; }
            // TODO: open create deck modal
          }}
          className="rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2 hover:opacity-70 transition-opacity cursor-pointer"
          style={{ borderColor: "rgba(49,54,40,0.2)", width: "176px", height: "176px" }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(49,54,40,0.08)" }}
          >
            <FontAwesomeIcon
              icon={faPlus}
              style={{ width: "1rem", height: "1rem", color: "var(--foreground)", opacity: 0.5 }}
            />
          </div>
          <p
            className="text-xs font-medium"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            New deck
          </p>
        </button>
      </div>

      {paywallModal && (
        <PaywallModal
          featureLabel="Flashcards"
          onClose={() => setPaywallModal(false)}
        />
      )}
    </div>
  );

  // ── SESSION VIEW ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setView("decks")}
          className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: "var(--foreground)", opacity: 0.5 }}
        >
          <FontAwesomeIcon
            icon={faChevronLeft}
            style={{ width: "0.7rem", height: "0.7rem" }}
          />
          Flashcards
        </button>
        {sessionStatus === "reviewing" && !isFreePreview && (
          <span
            className="text-sm tabular-nums"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            {index + 1} / {cards.length}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {sessionStatus === "reviewing" && !isFreePreview && (
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

      {/* Loading */}
      {sessionStatus === "loading" && (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.35 }}>
            Loading...
          </p>
        </div>
      )}

      {/* Done */}
      {sessionStatus === "done" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Session complete</h2>
            <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              {cards.length} card{cards.length !== 1 ? "s" : ""} reviewed
            </p>
          </div>
          <div className="flex gap-10">
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-semibold" style={{ color: "var(--success)" }}>
                {stats.correct}
              </span>
              <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                Got it
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-semibold" style={{ color: "#a20021" }}>
                {stats.wrong}
              </span>
              <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>
                Wrong
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIndex(0);
                setFlipped(false);
                setStats({ correct: 0, wrong: 0 });
                setSessionStatus("reviewing");
              }}
              className="rounded-full border h-10 px-6 text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer"
              style={{ borderColor: "rgba(49,54,40,0.2)" }}
            >
              Review again
            </button>
            <button
              onClick={() => setView("decks")}
              className="rounded-full h-10 px-6 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
            >
              Back to decks
            </button>
          </div>
        </div>
      )}

      {/* Reviewing */}
      {sessionStatus === "reviewing" && card && (
        <>
          {/* Flip card — click or spacebar toggles both ways */}
          <div style={{ perspective: "1200px" }}>
            <div
              onClick={() => setFlipped((f) => !f)}
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                transition: "transform 0.45s ease",
                position: "relative",
                minHeight: "280px",
                cursor: "pointer",
              }}
            >
              {/* Front */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  position: "absolute", inset: 0,
                  borderRadius: "1rem",
                  border: "1px solid rgba(49,54,40,0.12)",
                  backgroundColor: "var(--surface)",
                  padding: "1.75rem",
                  display: "flex", flexDirection: "column", gap: "1rem",
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
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.3 }}>
                  Tap or press space to reveal
                </p>
              </div>

              {/* Back */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  position: "absolute", inset: 0,
                  borderRadius: "1rem",
                  border: "1px solid rgba(49,54,40,0.12)",
                  backgroundColor: "var(--surface)",
                  padding: "1.75rem",
                  display: "flex", flexDirection: "column", gap: "1rem",
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
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.3 }}>
                  Tap or press space to flip back
                </p>
              </div>
            </div>
          </div>

          {/* ✓ / ✗ buttons — only after flip */}
          {flipped && (
            <div className="flex justify-center gap-6 pt-2">
              <button
                onClick={() => submitReview(false)}
                disabled={submitting}
                className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40 border-2"
                style={{
                  borderColor: "#a20021",
                  backgroundColor: "rgba(162,0,33,0.05)",
                }}
              >
                <FontAwesomeIcon
                  icon={faXmark}
                  style={{ width: "1.5rem", height: "1.5rem", color: "#a20021" }}
                />
              </button>
              <button
                onClick={() => submitReview(true)}
                disabled={submitting}
                className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "var(--success)" }}
              >
                <FontAwesomeIcon
                  icon={faCheck}
                  style={{ width: "1.5rem", height: "1.5rem", color: "white" }}
                />
              </button>
            </div>
          )}
        </>
      )}

      {paywallModal && (
        <PaywallModal
          featureLabel="Flashcards"
          onClose={() => setPaywallModal(false)}
        />
      )}
    </div>
  );
}
