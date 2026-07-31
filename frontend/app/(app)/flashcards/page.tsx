"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faCheck,
  faXmark,
  faPlus,
  faChevronLeft,
  faTrash,
  faPencil,
  faMagnifyingGlass,
  faEllipsisVertical,
  faWandMagicSparkles,
  faRotate,
} from "@fortawesome/free-solid-svg-icons";
import PaywallModal from "@/app/components/PaywallModal";
import Tooltip from "@/app/components/Tooltip";

const DECK_COLORS = [
  "#56876D",
  "#2d6a4f",
  "#457b9d",
  "#1d3557",
  "#7b2d8b",
  "#6b5b95",
  "#c1121f",
  "#b5451b",
  "#c77dff",
  "#d4a373",
  "#495057",
  "#343a40",
];

type Flashcard = { id?: number; front: string; back: string; pattern?: string };
type DeckCard = {
  id: number;
  front: string;
  back: string;
  pattern_id: number | null;
};
type View = "decks" | "session" | "edit";
type SessionStatus = "loading" | "reviewing" | "done";

export default function FlashcardsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
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
  const [deckModal, setDeckModal] = useState(false);
  const [deckTitle, setDeckTitle] = useState("");
  const [deckCards, setDeckCards] = useState([
    { front: "", back: "", pattern_id: null as number | null },
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<
    { front: boolean; back: boolean }[]
  >([{ front: false, back: false }]);
  const [patterns, setPatterns] = useState<{ id: number; pattern: string }[]>(
    [],
  );
  const [userDecks, setUserDecks] = useState<
    {
      id: number;
      title: string;
      color: string;
      card_count: number;
      created_at: string;
      last_studied_at: string | null;
    }[]
  >([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [deckSearch, setDeckSearch] = useState("");
  const [deckFilter, setDeckFilter] = useState<"recent" | "created">("recent");
  const [deckMenu, setDeckMenu] = useState<number | null>(null);
  const [editingDeck, setEditingDeck] = useState<{
    id: number;
    title: string;
    color: string;
  } | null>(null);
  const [deckColor, setDeckColor] = useState(DECK_COLORS[0]);
  const [editDeckId, setEditDeckId] = useState<number | null>(null);
  const [editDeckTitle, setEditDeckTitle] = useState("");
  const [editDeckCards, setEditDeckCards] = useState<DeckCard[]>([]);
  const [editDeckLoading, setEditDeckLoading] = useState(false);
  const [editCardError, setEditCardError] = useState("");
  const [activeSessionDeckId, setActiveSessionDeckId] = useState<number | null>(
    null,
  );

  // AI generation flow
  type GenStep = "mode" | "topic" | "count" | "deck_pick" | "loading" | "preview" | "error";
  const [genStep, setGenStep] = useState<GenStep | null>(null);
  const [genMode, setGenMode] = useState<"deck" | "cards">("deck");
  const [genTopic, setGenTopic] = useState("");
  const [genPatternId, setGenPatternId] = useState<number | null>(null);
  const [genCount, setGenCount] = useState(10);
  const [genDeckId, setGenDeckId] = useState<number | null>(null);
  const [genCards, setGenCards] = useState<{ front: string; back: string }[]>([]);
  const [genError, setGenError] = useState("");
  const [genSaving, setGenSaving] = useState(false);
  const [genExistingFronts, setGenExistingFronts] = useState<string[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const token = await getToken();
        const [meRes, decksRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (meRes.ok) {
          const data = await meRes.json();
          setIsPro(data.is_pro);
        }
        if (decksRes.ok) setUserDecks(await decksRes.json());
      } catch {
      } finally {
        setDecksLoading(false);
      }
    }
    init();
  }, [getToken]);

  async function deleteDeck(deckId: number) {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks/${deckId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch {}
    setDeckMenu(null);
  }

  async function openEditDeck(deck: { id: number; title: string }) {
    setEditDeckId(deck.id);
    setEditDeckTitle(deck.title);
    setEditDeckCards([]);
    setEditCardError("");
    setEditDeckLoading(true);
    setView("edit");
    try {
      const token = await getToken();
      const fetches: Promise<Response>[] = [
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards/${deck.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ];
      if (patterns.length === 0) {
        fetches.push(
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/patterns`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
      }
      const [cardsRes, patternsRes] = await Promise.all(fetches);
      if (cardsRes.ok) setEditDeckCards(await cardsRes.json());
      if (patternsRes?.ok) setPatterns(await patternsRes.json());
    } catch {}
    setEditDeckLoading(false);
  }

  async function saveCard(card: DeckCard) {
    if (card.id < 0) return;
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards/${card.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ front: card.front, back: card.back, pattern_id: card.pattern_id }),
      });
    } catch {}
  }

  async function deleteCard(cardId: number) {
    if (cardId < 0) {
      setEditDeckCards((prev) => prev.filter((c) => c.id !== cardId));
      return;
    }
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards/${cardId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditDeckCards((prev) => prev.filter((c) => c.id !== cardId));
      setUserDecks((prev) =>
        prev.map((d) =>
          d.id === editDeckId ? { ...d, card_count: d.card_count - 1 } : d,
        ),
      );
    } catch {}
  }

  function addCardToDeck() {
    setEditCardError("");
    setEditDeckCards((prev) => [...prev, { id: -Date.now(), front: "", back: "", pattern_id: null }]);
  }

  async function handleSaveChanges() {
    const newCards = editDeckCards.filter((c) => c.id < 0);
    const hasBlank = newCards.some((c) => !c.front.trim() || !c.back.trim());
    if (hasBlank) {
      setEditCardError("All new cards require both a front and a back.");
      return;
    }
    if (newCards.length > 0 && editDeckId) {
      const token = await getToken();
      for (const card of newCards) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks/${editDeckId}/cards`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ front: card.front, back: card.back, pattern_id: card.pattern_id }),
        });
        if (res.ok) {
          const created = await res.json();
          setEditDeckCards((prev) => prev.map((c) => c.id === card.id ? created : c));
          setUserDecks((prev) =>
            prev.map((d) => d.id === editDeckId ? { ...d, card_count: d.card_count + 1 } : d),
          );
        }
      }
    }
    setEditCardError("");
    setView("decks");
  }

  async function renameDeck(deckId: number, title: string, color: string) {
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/decks/${deckId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title, color }),
        },
      );
      if (res.ok) {
        setUserDecks((prev) =>
          prev.map((d) => (d.id === deckId ? { ...d, title, color } : d)),
        );
      }
    } catch {}
    setEditingDeck(null);
  }

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

  async function startUserDeck(deckId: number) {
    setActiveSessionDeckId(deckId);
    setView("session");
    setSessionStatus("loading");
    setIndex(0);
    setFlipped(false);
    setStats({ correct: 0, wrong: 0 });
    setIsFreePreview(false);
    try {
      const token = await getToken();
      const [res] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards/${deckId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks/${deckId}/study`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const now = new Date().toISOString();
      setUserDecks((prev) =>
        prev.map((d) => (d.id === deckId ? { ...d, last_studied_at: now } : d)),
      );
      if (!res.ok) {
        setSessionStatus("done");
        return;
      }
      const data = await res.json();
      if (data.length === 0) {
        setSessionStatus("done");
        return;
      }
      setCards(data);
      setSessionStatus("reviewing");
    } catch {
      setSessionStatus("done");
    }
  }

  async function startDeck() {
    setActiveSessionDeckId(null);
    setView("session");
    setSessionStatus("loading");
    setIndex(0);
    setFlipped(false);
    setStats({ correct: 0, wrong: 0 });
    setIsFreePreview(false);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setSessionStatus("done");
        return;
      }
      const data = await res.json();
      if (data.length === 0) {
        setSessionStatus("done");
        return;
      }
      setCards(data);
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

  async function createDeck() {
    const trimmed = deckTitle.trim();

    const errors = deckCards.map((c) => ({
      front: !c.front.trim() && !!c.back.trim(),
      back: !!c.front.trim() && !c.back.trim(),
    }));
    const hasFieldError = errors.some((e) => e.front || e.back);
    const validCards = deckCards.filter((c) => c.front.trim() && c.back.trim());

    if (hasFieldError) {
      setCardErrors(errors);
      return;
    }
    if (!trimmed || validCards.length === 0) {
      setCreateError("Add a title and at least one complete card.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmed,
          color: deckColor,
          cards: validCards,
        }),
      });
      if (!res.ok) {
        setCreateError("Something went wrong. Please try again.");
        return;
      }
      // Refresh deck list
      const token2 = await getToken();
      const decksRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks`, {
        headers: { Authorization: `Bearer ${token2}` },
      });
      if (decksRes.ok) setUserDecks(await decksRes.json());
      setDeckModal(false);
      setDeckTitle("");
      setDeckCards([{ front: "", back: "", pattern_id: null }]);
      setDeckColor(DECK_COLORS[0]);
      setCardErrors([{ front: false, back: false }]);
    } catch {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function closeGen() {
    setGenStep(null);
    setGenTopic("");
    setGenPatternId(null);
    setGenCount(10);
    setGenDeckId(null);
    setGenCards([]);
    setGenError("");
    setGenExistingFronts([]);
  }

  async function runGenerate() {
    setGenStep("loading");
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic: genTopic, count: genCount, existing_fronts: genExistingFronts }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.detail || "Something went wrong. Please try again.");
        setGenStep("error");
        return;
      }
      setGenCards(data.cards);
      setGenStep("preview");
    } catch {
      setGenError("Something went wrong. Please try again.");
      setGenStep("error");
    }
  }

  async function saveGenerated() {
    setGenSaving(true);
    try {
      const token = await getToken();
      if (genMode === "deck") {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: genTopic.slice(0, 60),
            color: DECK_COLORS[0],
            cards: genCards.map((c) => ({ ...c, pattern_id: genPatternId })),
          }),
        });
        if (res.ok) {
          const token2 = await getToken();
          const decksRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks`, {
            headers: { Authorization: `Bearer ${token2}` },
          });
          if (decksRes.ok) {
            setUserDecks(await decksRes.json());
            closeGen();
          }
        }
      } else {
        if (!genDeckId) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/decks/${genDeckId}/cards/bulk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            cards: genCards.map((c) => ({ ...c, pattern_id: genPatternId })),
          }),
        });
        if (res.ok) {
          const { created } = await res.json();
          setUserDecks((prev) =>
            prev.map((d) => d.id === genDeckId ? { ...d, card_count: d.card_count + created } : d),
          );
          closeGen();
        }
      }
    } catch {
    } finally {
      setGenSaving(false);
    }
  }

  const q = deckSearch.toLowerCase();
  const systemDeckVisible = !q || "interview patterns".includes(q);
  const filteredDecks = userDecks
    .filter((d) => d.title.toLowerCase().includes(q))
    .sort((a, b) => {
      if (deckFilter === "created")
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      // "recent" — last studied, falling back to created_at for never-studied decks
      const aTime = a.last_studied_at
        ? new Date(a.last_studied_at).getTime()
        : new Date(a.created_at).getTime();
      const bTime = b.last_studied_at
        ? new Date(b.last_studied_at).getTime()
        : new Date(b.created_at).getTime();
      return bTime - aTime;
    });
  const noResults = q && !systemDeckVisible && filteredDecks.length === 0;

  // ── DECKS VIEW ────────────────────────────────────────────────────────────
  if (view === "decks")
    return (
      <div
        className="p-6 sm:p-8 max-w-3xl mx-auto w-full"
        onClick={() => setDeckMenu(null)}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6">
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

        {/* Filter + Search row */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={deckFilter}
            onChange={(e) => setDeckFilter(e.target.value as typeof deckFilter)}
            className="rounded-full border text-xs font-medium px-3 py-1.5 outline-none cursor-pointer"
            style={{
              borderColor: "rgba(49,54,40,0.15)",
              backgroundColor: "var(--surface)",
              color: "var(--foreground)",
            }}
          >
            <option value="recent">Recent</option>
            <option value="created">Created</option>
          </select>
          <div
            className="flex items-center gap-2 flex-1 min-w-[160px] rounded-full border px-3 py-1.5"
            style={{
              borderColor: "rgba(49,54,40,0.15)",
              backgroundColor: "var(--surface)",
            }}
          >
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              style={{
                width: "0.75rem",
                height: "0.75rem",
                color: "var(--foreground)",
                opacity: 0.35,
              }}
            />
            <input
              value={deckSearch}
              onChange={(e) => setDeckSearch(e.target.value)}
              placeholder="Search flashcards"
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: "var(--foreground)" }}
            />
          </div>
        </div>

        {/* Skeleton */}
        {decksLoading ? (
          <div className="flex flex-wrap gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border animate-pulse"
                style={{
                  borderColor: "rgba(49,54,40,0.1)",
                  backgroundColor: "var(--surface)",
                  width: "176px",
                  height: "176px",
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {noResults ? (
              <p
                className="text-sm py-8"
                style={{ color: "var(--foreground)", opacity: 0.4 }}
              >
                No results found for &ldquo;{deckSearch}&rdquo;
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {/* System deck — hidden when search doesn't match */}
                {systemDeckVisible && (
                  <Tooltip content="Free for all users. Cards that need more work surface more often.">
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
                          style={{
                            width: "1rem",
                            height: "1rem",
                            color: "#313628",
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          Interview Patterns
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--foreground)", opacity: 0.45 }}
                        >
                          22 cards
                        </p>
                      </div>
                    </button>
                  </Tooltip>
                )}

                {/* User decks */}
                {filteredDecks.map((deck) => (
                  <div
                    key={deck.id}
                    className="relative"
                    style={{ width: "176px", height: "176px" }}
                  >
                    <button
                      onClick={() => startUserDeck(deck.id)}
                      className="w-full h-full rounded-2xl border p-5 flex flex-col gap-3 text-left hover:opacity-80 transition-opacity cursor-pointer"
                      style={{
                        borderColor: "rgba(49,54,40,0.15)",
                        backgroundColor: "var(--surface)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: deck.color }}
                      >
                        <FontAwesomeIcon
                          icon={faLayerGroup}
                          style={{
                            width: "1rem",
                            height: "1rem",
                            color: "white",
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {deck.title}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--foreground)", opacity: 0.45 }}
                        >
                          {deck.card_count} card
                          {deck.card_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </button>
                    {/* 3-dot menu */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeckMenu(deckMenu === deck.id ? null : deck.id);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ backgroundColor: "rgba(49,54,40,0.07)" }}
                    >
                      <FontAwesomeIcon
                        icon={faEllipsisVertical}
                        style={{
                          width: "0.65rem",
                          height: "0.65rem",
                          color: "var(--foreground)",
                          opacity: 0.5,
                        }}
                      />
                    </button>
                    {deckMenu === deck.id && (
                      <div
                        className="absolute top-9 right-2 z-10 rounded-xl border py-1 flex flex-col min-w-[120px]"
                        style={{
                          backgroundColor: "var(--surface)",
                          borderColor: "rgba(49,54,40,0.12)",
                          boxShadow: "0 4px 16px rgba(49,54,40,0.1)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            openEditDeck(deck);
                            setDeckMenu(null);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs hover:opacity-70 cursor-pointer transition-opacity"
                          style={{ color: "var(--foreground)" }}
                        >
                          <FontAwesomeIcon
                            icon={faPencil}
                            style={{
                              width: "0.7rem",
                              height: "0.7rem",
                              opacity: 0.5,
                            }}
                          />
                          Edit cards
                        </button>
                        <button
                          onClick={() => {
                            setEditingDeck({
                              id: deck.id,
                              title: deck.title,
                              color: deck.color,
                            });
                            setDeckMenu(null);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs hover:opacity-70 cursor-pointer transition-opacity"
                          style={{ color: "var(--foreground)" }}
                        >
                          <FontAwesomeIcon
                            icon={faPencil}
                            style={{
                              width: "0.7rem",
                              height: "0.7rem",
                              opacity: 0.5,
                            }}
                          />
                          Rename
                        </button>
                        <button
                          onClick={() => deleteDeck(deck.id)}
                          className="flex items-center gap-2 px-3 py-2 text-xs hover:opacity-70 cursor-pointer transition-opacity"
                          style={{ color: "#a20021" }}
                        >
                          <FontAwesomeIcon
                            icon={faTrash}
                            style={{ width: "0.7rem", height: "0.7rem" }}
                          />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* New deck — plus opens manual flow; wand corner button opens AI flow */}
                <div
                  className="relative rounded-2xl border border-dashed flex flex-col items-center justify-center"
                  style={{
                    borderColor: "rgba(49,54,40,0.2)",
                    width: "176px",
                    height: "176px",
                  }}
                >
                  {isPro === false && (
                    <span
                      className="absolute top-2.5 left-2.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "var(--accent)", color: "#313628" }}
                    >
                      Pro
                    </span>
                  )}
                  {/* Plus — manual deck creation */}
                  <button
                    onClick={async () => {
                      if (isPro === false) { router.push("/pricing"); return; }
                      if (patterns.length === 0) {
                        const token = await getToken();
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/patterns`, { headers: { Authorization: `Bearer ${token}` } });
                        if (res.ok) setPatterns(await res.json());
                      }
                      setDeckModal(true);
                    }}
                    className="flex flex-col items-center justify-center gap-2 hover:opacity-70 transition-opacity cursor-pointer w-full h-full"
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
                    <p className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.4 }}>New deck</p>
                  </button>
                  {/* AI generate — rendered last so it stacks above the full-width plus button */}
                  <div className="absolute top-2.5 right-2.5 z-10 inline-flex group/wand">
                    <button
                      onClick={async () => {
                        if (isPro === false) { router.push("/pricing"); return; }
                        if (patterns.length === 0) {
                          const token = await getToken();
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/patterns`, { headers: { Authorization: `Bearer ${token}` } });
                          if (res.ok) setPatterns(await res.json());
                        }
                        setGenStep("mode");
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: "rgba(49,54,40,0.07)" }}
                    >
                      <FontAwesomeIcon
                        icon={faWandMagicSparkles}
                        style={{ width: "0.65rem", height: "0.65rem", color: "var(--accent)" }}
                      />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover/wand:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                      <div className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}>
                        Generate with AI
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Rename modal */}
        {editingDeck && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={() => setEditingDeck(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-7 flex flex-col gap-5"
              style={{ backgroundColor: "var(--surface)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-base font-semibold">Rename deck</h2>
              <input
                autoFocus
                value={editingDeck.title}
                onChange={(e) =>
                  setEditingDeck({ ...editingDeck, title: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    renameDeck(
                      editingDeck.id,
                      editingDeck.title,
                      editingDeck.color,
                    );
                }}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "rgba(49,54,40,0.18)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
              <div className="flex flex-col gap-2">
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  Color
                </p>
                <div className="flex flex-wrap gap-2">
                  {DECK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setEditingDeck({ ...editingDeck, color: c })
                      }
                      className="w-7 h-7 rounded-full cursor-pointer flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: c,
                        outline:
                          editingDeck.color === c ? `2px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    >
                      {editingDeck.color === c && (
                        <FontAwesomeIcon
                          icon={faCheck}
                          style={{
                            width: "0.6rem",
                            height: "0.6rem",
                            color: "white",
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingDeck(null)}
                  className="rounded-full border h-9 px-4 text-sm cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ borderColor: "rgba(49,54,40,0.2)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    renameDeck(
                      editingDeck.id,
                      editingDeck.title,
                      editingDeck.color,
                    )
                  }
                  className="rounded-full h-9 px-4 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: "var(--foreground)",
                    color: "var(--surface)",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {paywallModal && (
          <PaywallModal
            featureLabel="Flashcards"
            onClose={() => setPaywallModal(false)}
          />
        )}

        {/* AI generation modal */}
        {genStep !== null && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 py-10 overflow-y-auto"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={() => { if (genStep !== "loading") closeGen(); }}
          >
            <div
              className="w-full max-w-lg rounded-2xl flex flex-col gap-6 p-8 my-auto"
              style={{ backgroundColor: "var(--surface)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Step: mode */}
              {genStep === "mode" && (
                <>
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faWandMagicSparkles} style={{ width: "1rem", height: "1rem", color: "var(--accent)" }} />
                    <h2 className="text-lg font-semibold">Generate flashcards</h2>
                  </div>
                  <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.55 }}>What do you want to generate?</p>
                  <div className="flex flex-col gap-3">
                    {([
                      { id: "deck" as const, label: "Generate a new deck", desc: "AI creates a full deck of flashcards on your chosen topic" },
                      { id: "cards" as const, label: "Add cards to an existing deck", desc: "AI generates extra cards and adds them to one of your decks" },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setGenMode(opt.id); setGenStep("topic"); }}
                        className="rounded-xl border p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
                        style={{ borderColor: "rgba(49,54,40,0.12)" }}
                      >
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--foreground)", opacity: 0.5 }}>{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <button onClick={closeGen} className="text-sm self-start cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "var(--foreground)", opacity: 0.4 }}>Cancel</button>
                </>
              )}

              {/* Step: topic */}
              {genStep === "topic" && (
                <>
                  <h2 className="text-lg font-semibold">What do you want to study?</h2>
                  <div className="flex flex-col gap-1.5">
                    <input
                      autoFocus
                      value={genTopic}
                      onChange={(e) => setGenTopic(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && genTopic.trim()) setGenStep("count"); }}
                      placeholder={`e.g. "Binary search", "React hooks", "SQL joins", "STAR method"`}
                      className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ borderColor: "rgba(49,54,40,0.18)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                    />
                  </div>
                  {patterns.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.5 }}>Tag cards with a pattern (optional)</label>
                      <select
                        value={genPatternId ?? ""}
                        onChange={(e) => setGenPatternId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                        style={{ borderColor: "rgba(49,54,40,0.15)", backgroundColor: "var(--background)", color: genPatternId ? "var(--foreground)" : "rgba(49,54,40,0.35)" }}
                      >
                        <option value="">No pattern tag</option>
                        {patterns.map((p) => <option key={p.id} value={p.id}>{p.pattern}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setGenStep("mode")} className="text-sm cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "var(--foreground)", opacity: 0.4 }}>Back</button>
                    <button
                      disabled={!genTopic.trim()}
                      onClick={() => setGenStep("count")}
                      className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}

              {/* Step: count */}
              {genStep === "count" && (
                <>
                  <h2 className="text-lg font-semibold">How many cards?</h2>
                  {genMode === "deck" ? (
                    <div className="flex gap-3 flex-wrap">
                      {[5, 10, 15, 20].map((n) => (
                        <button
                          key={n}
                          onClick={() => setGenCount(n)}
                          className="rounded-full border h-10 px-5 text-sm font-medium cursor-pointer transition-colors"
                          style={{
                            borderColor: genCount === n ? "var(--foreground)" : "rgba(49,54,40,0.2)",
                            backgroundColor: genCount === n ? "var(--foreground)" : "transparent",
                            color: genCount === n ? "var(--surface)" : "var(--foreground)",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={genCount}
                        onChange={(e) => setGenCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                        className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 w-28"
                        style={{ borderColor: "rgba(49,54,40,0.18)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                      />
                      <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.45 }}>Maximum 20 cards per generation</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setGenStep("topic")} className="text-sm cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "var(--foreground)", opacity: 0.4 }}>Back</button>
                    <button
                      onClick={() => { if (genMode === "cards") setGenStep("deck_pick"); else runGenerate(); }}
                      className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
                    >
                      {genMode === "cards" ? "Next" : "Generate"}
                    </button>
                  </div>
                </>
              )}

              {/* Step: deck pick (mode=cards only) */}
              {genStep === "deck_pick" && (
                <>
                  <h2 className="text-lg font-semibold">Which deck?</h2>
                  {userDecks.length === 0 ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.55 }}>You have no existing decks. Switch to creating a new deck instead.</p>
                      <button onClick={() => { setGenMode("deck"); setGenStep("count"); }} className="text-sm underline cursor-pointer self-start" style={{ color: "var(--accent)" }}>Generate a new deck</button>
                    </div>
                  ) : (
                    <select
                      value={genDeckId ?? ""}
                      onChange={async (e) => {
                        const id = Number(e.target.value);
                        setGenDeckId(id || null);
                        setGenExistingFronts([]);
                        if (id) {
                          const token = await getToken();
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/flashcards/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                          if (res.ok) {
                            const cards = await res.json();
                            setGenExistingFronts(cards.map((c: { front: string }) => c.front));
                          }
                        }
                      }}
                      className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ borderColor: "rgba(49,54,40,0.18)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                    >
                      <option value="">Select a deck...</option>
                      {userDecks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setGenStep("count")} className="text-sm cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "var(--foreground)", opacity: 0.4 }}>Back</button>
                    <button
                      disabled={!genDeckId}
                      onClick={runGenerate}
                      className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
                    >
                      Generate
                    </button>
                  </div>
                </>
              )}

              {/* Step: loading */}
              {genStep === "loading" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                  <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.55 }}>Generating your flashcards...</p>
                </div>
              )}

              {/* Step: preview */}
              {genStep === "preview" && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Preview</h2>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(49,54,40,0.08)", color: "var(--foreground)" }}>
                      {genCards.length} card{genCards.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {genCards.map((card, i) => (
                      <div key={i} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: "rgba(49,54,40,0.12)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium tabular-nums" style={{ color: "var(--foreground)", opacity: 0.35 }}>Card {i + 1}</span>
                          <button
                            onClick={() => setGenCards((prev) => prev.filter((_, idx) => idx !== i))}
                            className="cursor-pointer hover:opacity-70 transition-opacity"
                            style={{ color: "var(--foreground)", opacity: 0.3 }}
                          >
                            <FontAwesomeIcon icon={faTrash} style={{ width: "0.75rem", height: "0.75rem" }} />
                          </button>
                        </div>
                        <textarea
                          value={card.front}
                          onChange={(e) => setGenCards((prev) => prev.map((c, idx) => idx === i ? { ...c, front: e.target.value } : c))}
                          placeholder="Front"
                          rows={2}
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                          style={{ borderColor: "rgba(49,54,40,0.15)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                        />
                        <textarea
                          value={card.back}
                          onChange={(e) => setGenCards((prev) => prev.map((c, idx) => idx === i ? { ...c, back: e.target.value } : c))}
                          placeholder="Back"
                          rows={2}
                          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                          style={{ borderColor: "rgba(49,54,40,0.15)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setGenCards((prev) => [...prev, { front: "", back: "" }])}
                      className="rounded-xl border border-dashed h-10 flex items-center justify-center gap-2 text-sm cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ borderColor: "rgba(49,54,40,0.2)", color: "var(--foreground)", opacity: 0.5 }}
                    >
                      <FontAwesomeIcon icon={faPlus} style={{ width: "0.7rem", height: "0.7rem" }} />
                      Add a new card
                    </button>
                  </div>
                  <div className="flex gap-3 justify-end pt-1">
                    <button
                      onClick={runGenerate}
                      disabled={genSaving}
                      className="rounded-full border h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-40 flex items-center gap-2"
                      style={{ borderColor: "rgba(49,54,40,0.2)" }}
                    >
                      <FontAwesomeIcon icon={faRotate} style={{ width: "0.75rem", height: "0.75rem" }} />
                      Regenerate
                    </button>
                    <button
                      onClick={saveGenerated}
                      disabled={genSaving || genCards.length === 0}
                      className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
                    >
                      {genSaving ? "Saving..." : genMode === "deck" ? "Save deck" : "Add to deck"}
                    </button>
                  </div>
                </>
              )}

              {/* Step: error */}
              {genStep === "error" && (
                <>
                  <h2 className="text-lg font-semibold">Could not generate cards</h2>
                  <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.6 }}>{genError}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setGenStep("topic")} className="rounded-full border h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity" style={{ borderColor: "rgba(49,54,40,0.2)" }}>
                      Try a different topic
                    </button>
                    <button onClick={closeGen} className="text-sm cursor-pointer hover:opacity-70 transition-opacity self-center" style={{ color: "var(--foreground)", opacity: 0.4 }}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Create deck modal */}
        {deckModal && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 py-10 overflow-y-auto"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={() => {
              setDeckModal(false);
              setDeckColor(DECK_COLORS[0]);
              setCardErrors([{ front: false, back: false }]);
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl flex flex-col gap-6 p-8 my-auto"
              style={{ backgroundColor: "var(--surface)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold">New deck</h2>

              {/* Deck title */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  Deck title
                </label>
                <input
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  placeholder="e.g. Dynamic Programming"
                  className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    borderColor: "rgba(49,54,40,0.18)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              {/* Color picker */}
              <div className="flex flex-col gap-2">
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  Color
                </p>
                <div className="flex flex-wrap gap-2">
                  {DECK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDeckColor(c)}
                      className="w-7 h-7 rounded-full cursor-pointer flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: c,
                        outline: deckColor === c ? `2px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    >
                      {deckColor === c && (
                        <FontAwesomeIcon
                          icon={faCheck}
                          style={{
                            width: "0.6rem",
                            height: "0.6rem",
                            color: "white",
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-3">
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  Cards
                </p>
                {deckCards.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl border p-4 flex flex-col gap-3"
                    style={{ borderColor: "rgba(49,54,40,0.12)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: "var(--foreground)", opacity: 0.35 }}
                      >
                        Card {i + 1}
                      </span>
                      {deckCards.length > 1 && (
                        <button
                          onClick={() => {
                            setDeckCards((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            );
                            setCardErrors((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            );
                          }}
                          className="cursor-pointer hover:opacity-70 transition-opacity"
                          style={{ color: "var(--foreground)", opacity: 0.3 }}
                        >
                          <FontAwesomeIcon
                            icon={faTrash}
                            style={{ width: "0.75rem", height: "0.75rem" }}
                          />
                        </button>
                      )}
                    </div>
                    <input
                      value={c.front}
                      onChange={(e) => {
                        setDeckCards((prev) =>
                          prev.map((card, idx) =>
                            idx === i
                              ? { ...card, front: e.target.value }
                              : card,
                          ),
                        );
                        setCardErrors((prev) =>
                          prev.map((err, idx) =>
                            idx === i ? { ...err, front: false } : err,
                          ),
                        );
                      }}
                      placeholder="Term (front)"
                      className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{
                        borderColor: cardErrors[i]?.front
                          ? "#a20021"
                          : "rgba(49,54,40,0.15)",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                      }}
                    />
                    {cardErrors[i]?.front && (
                      <p
                        className="text-xs"
                        style={{ color: "#a20021", marginTop: "-0.25rem" }}
                      >
                        Term is required.
                      </p>
                    )}
                    <input
                      value={c.back}
                      onChange={(e) => {
                        setDeckCards((prev) =>
                          prev.map((card, idx) =>
                            idx === i
                              ? { ...card, back: e.target.value }
                              : card,
                          ),
                        );
                        setCardErrors((prev) =>
                          prev.map((err, idx) =>
                            idx === i ? { ...err, back: false } : err,
                          ),
                        );
                      }}
                      placeholder="Definition (back)"
                      className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{
                        borderColor: cardErrors[i]?.back
                          ? "#a20021"
                          : "rgba(49,54,40,0.15)",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                      }}
                    />
                    {cardErrors[i]?.back && (
                      <p
                        className="text-xs"
                        style={{ color: "#a20021", marginTop: "-0.25rem" }}
                      >
                        Definition is required.
                      </p>
                    )}
                    <select
                      value={c.pattern_id ?? ""}
                      onChange={(e) =>
                        setDeckCards((prev) =>
                          prev.map((card, idx) =>
                            idx === i
                              ? {
                                  ...card,
                                  pattern_id: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                }
                              : card,
                          ),
                        )
                      }
                      className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{
                        borderColor: "rgba(49,54,40,0.15)",
                        backgroundColor: "var(--background)",
                        color: c.pattern_id
                          ? "var(--foreground)"
                          : "rgba(49,54,40,0.35)",
                      }}
                    >
                      <option value="">Pattern (optional)</option>
                      {patterns.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.pattern}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setDeckCards((prev) => [
                      ...prev,
                      { front: "", back: "", pattern_id: null },
                    ]);
                    setCardErrors((prev) => [
                      ...prev,
                      { front: false, back: false },
                    ]);
                  }}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-70 transition-opacity self-start"
                  style={{ color: "var(--foreground)", opacity: 0.45 }}
                >
                  <FontAwesomeIcon
                    icon={faPlus}
                    style={{ width: "0.75rem", height: "0.75rem" }}
                  />
                  Add card
                </button>
              </div>

              {createError && (
                <p className="text-sm" style={{ color: "#a20021" }}>
                  {createError}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button
                  onClick={() => {
                    setDeckModal(false);
                    setDeckTitle("");
                    setDeckCards([{ front: "", back: "", pattern_id: null }]);
                    setDeckColor(DECK_COLORS[0]);
                    setCardErrors([{ front: false, back: false }]);
                    setCreateError(null);
                  }}
                  className="rounded-full border h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ borderColor: "rgba(49,54,40,0.2)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={createDeck}
                  disabled={creating}
                  className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--foreground)",
                    color: "var(--surface)",
                  }}
                >
                  {creating ? "Creating..." : "Create deck"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────
  if (view === "edit")
    return (
      <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
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
        </div>

        <h1 className="text-lg font-semibold">{editDeckTitle}</h1>

        {editDeckLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border animate-pulse"
                style={{
                  borderColor: "rgba(49,54,40,0.1)",
                  backgroundColor: "var(--surface)",
                  height: "128px",
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {editDeckCards.length === 0 && (
              <p
                className="text-sm py-4"
                style={{ color: "var(--foreground)", opacity: 0.35 }}
              >
                No cards yet. Add one below.
              </p>
            )}
            {editDeckCards.map((card, i) => (
              <div
                key={card.id}
                className="rounded-xl border p-4 flex flex-col gap-3"
                style={{
                  borderColor: "rgba(49,54,40,0.12)",
                  backgroundColor: "var(--surface)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: "var(--foreground)", opacity: 0.35 }}
                  >
                    Card {i + 1}
                  </span>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="cursor-pointer hover:opacity-70 transition-opacity"
                    style={{ color: "var(--foreground)", opacity: 0.3 }}
                  >
                    <FontAwesomeIcon
                      icon={faTrash}
                      style={{ width: "0.75rem", height: "0.75rem" }}
                    />
                  </button>
                </div>
                <textarea
                  value={card.front}
                  onChange={(e) =>
                    setEditDeckCards((prev) =>
                      prev.map((c) =>
                        c.id === card.id ? { ...c, front: e.target.value } : c,
                      ),
                    )
                  }
                  onBlur={() => {
                    const c = editDeckCards.find((c) => c.id === card.id);
                    if (c) saveCard(c);
                  }}
                  placeholder="Term (front)"
                  rows={2}
                  className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                  style={{
                    borderColor: "rgba(49,54,40,0.15)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
                <textarea
                  value={card.back}
                  onChange={(e) =>
                    setEditDeckCards((prev) =>
                      prev.map((c) =>
                        c.id === card.id ? { ...c, back: e.target.value } : c,
                      ),
                    )
                  }
                  onBlur={() => {
                    const c = editDeckCards.find((c) => c.id === card.id);
                    if (c) saveCard(c);
                  }}
                  placeholder="Definition (back)"
                  rows={2}
                  className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                  style={{
                    borderColor: "rgba(49,54,40,0.15)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
                <select
                  value={card.pattern_id ?? ""}
                  onChange={async (e) => {
                    const updated = {
                      ...card,
                      pattern_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    };
                    setEditDeckCards((prev) =>
                      prev.map((c) => (c.id === card.id ? updated : c)),
                    );
                    await saveCard(updated);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    borderColor: "rgba(49,54,40,0.15)",
                    backgroundColor: "var(--background)",
                    color: card.pattern_id
                      ? "var(--foreground)"
                      : "rgba(49,54,40,0.35)",
                  }}
                >
                  <option value="">Pattern (optional)</option>
                  {patterns.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pattern}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              onClick={addCardToDeck}
              className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-70 transition-opacity self-start mt-2"
              style={{ color: "var(--foreground)", opacity: 0.45 }}
            >
              <FontAwesomeIcon
                icon={faPlus}
                style={{ width: "0.75rem", height: "0.75rem" }}
              />
              Add card
            </button>
          </div>
        )}

        <div
          className="flex flex-col gap-2 pt-2 border-t"
          style={{ borderColor: "rgba(49,54,40,0.1)" }}
        >
          {editCardError && (
            <p className="text-xs text-right" style={{ color: "#c0392b" }}>{editCardError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setEditCardError(""); setView("decks"); }}
              className="rounded-full border h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity"
              style={{ borderColor: "rgba(49,54,40,0.2)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--foreground)", color: "var(--surface)" }}
            >
              Save changes
            </button>
          </div>
        </div>
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

      {/* Loading skeleton */}
      {sessionStatus === "loading" && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border animate-pulse"
            style={{
              borderColor: "rgba(49,54,40,0.1)",
              backgroundColor: "var(--surface)",
              minHeight: "280px",
            }}
          />
          <div className="flex justify-center gap-6 pt-2">
            <div
              className="w-16 h-16 rounded-full animate-pulse"
              style={{ backgroundColor: "rgba(49,54,40,0.08)" }}
            />
            <div
              className="w-16 h-16 rounded-full animate-pulse"
              style={{ backgroundColor: "rgba(49,54,40,0.08)" }}
            />
          </div>
        </div>
      )}

      {/* Done */}
      {sessionStatus === "done" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          {stats.correct + stats.wrong === 0 ? (
            /* All caught up — nothing was due */
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold">
                You&apos;re all caught up!
              </h2>
              <p
                className="text-sm"
                style={{ color: "var(--foreground)", opacity: 0.5 }}
              >
                No cards due right now. Check back later — the ones you
                struggled with will surface first.
              </p>
            </div>
          ) : (
            /* Session completed */
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">Session complete</h2>
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground)", opacity: 0.5 }}
                >
                  {stats.correct + stats.wrong} card
                  {stats.correct + stats.wrong !== 1 ? "s" : ""} reviewed
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
                    Missed
                  </span>
                </div>
              </div>
            </>
          )}
          <div className="flex gap-3">
            {/* Review again only makes sense for user decks — system deck is SRS-gated */}
            {activeSessionDeckId !== null && (
              <button
                onClick={() => startUserDeck(activeSessionDeckId)}
                className="rounded-full border h-10 px-6 text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer"
                style={{ borderColor: "rgba(49,54,40,0.2)" }}
              >
                Review again
              </button>
            )}
            <button
              onClick={() => setView("decks")}
              className="rounded-full h-10 px-6 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              style={{
                backgroundColor: "var(--foreground)",
                color: "var(--surface)",
              }}
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
                  {card.front.includes(" — ")
                    ? card.front.split(" — ").slice(1).join(" — ")
                    : card.front}
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--foreground)", opacity: 0.3 }}
                >
                  Tap or press space to reveal
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
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "#313628",
                    }}
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
                <p
                  className="text-xs"
                  style={{ color: "var(--foreground)", opacity: 0.3 }}
                >
                  Tap or press space to flip back
                </p>
              </div>
            </div>
          </div>

          {/* ✓ / ✗ buttons — only after flip */}
          {flipped && (
            <div className="flex justify-center gap-6 pt-2">
              <Tooltip
                content="Missed it — this card will come back sooner"
                position="bottom"
              >
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
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      color: "#a20021",
                    }}
                  />
                </button>
              </Tooltip>
              <Tooltip
                content="Got it — this card will be shown less often"
                position="bottom"
              >
                <button
                  onClick={() => submitReview(true)}
                  disabled={submitting}
                  className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "var(--success)" }}
                >
                  <FontAwesomeIcon
                    icon={faCheck}
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      color: "white",
                    }}
                  />
                </button>
              </Tooltip>
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
