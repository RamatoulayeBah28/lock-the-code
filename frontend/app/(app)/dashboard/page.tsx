"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPen,
  faTrash,
  faPlus,
  faMagnifyingGlass,
  faXmark,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import Tooltip from "@/app/components/Tooltip";

function UpgradeBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("upgrade") !== "success") return null;
  return (
    <div
      className="mb-6 rounded-xl px-4 py-3 text-sm font-medium"
      style={{
        backgroundColor: "rgba(49,54,40,0.08)",
        color: "var(--foreground)",
      }}
    >
      Welcome to Lock The Code Pro ❤︎
    </div>
  );
}

type Problem = {
  id: number;
  title: string;
  difficulty: string;
  note: string | null;
  url: string | null;
  topics: string[];
  patterns: string[];
};

const DIFF_COLOR: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

export default function DashboardPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const ph = usePostHog();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarIcsUrl, setCalendarIcsUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<number[]>([]);
  const [allTopics, setAllTopics] = useState<{ id: number; topic: string }[]>(
    [],
  );
  const [allPatterns, setAllPatterns] = useState<
    { id: number; pattern: string }[]
  >([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [patternSearch, setPatternSearch] = useState("");
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState<"" | "easy" | "medium" | "hard">(
    "",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function loadAll() {
      const token = await getToken();
      const [problemsRes, topicsRes, patternsRes, calRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/topics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/patterns`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/calendar/token`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!problemsRes.ok) {
        setError(`Request failed: ${problemsRes.status}`);
        return;
      }
      setProblems(await problemsRes.json());
      if (topicsRes.ok) setAllTopics(await topicsRes.json());
      if (patternsRes.ok) setAllPatterns(await patternsRes.json());
      if (calRes.ok) {
        const { token: calToken, user_id } = await calRes.json();
        setCalendarIcsUrl(
          `${process.env.NEXT_PUBLIC_API_URL}/calendar/${user_id}/${calToken}.ics`,
        );
      }
    }
    loadAll().catch((err) => setError(String(err)));
  }, [isLoaded, isSignedIn, getToken]);

  function handleCalendarSync(type: "google" | "apple") {
    if (!calendarIcsUrl) return;
    const webcalUrl = calendarIcsUrl.replace(/^https?:\/\//, "webcal://");
    if (type === "google") {
      window.open(
        `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`,
        "_blank",
      );
    } else {
      const a = document.createElement("a");
      a.href = webcalUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  function openAddForm() {
    setEditingProblem(null);
    setTitle("");
    setDifficulty("");
    setNote("");
    setUrl("");
    setSelectedTopics([]);
    setSelectedPatterns([]);
    setTopicSearch("");
    setPatternSearch("");
    setShowForm(true);
  }

  function openEditForm(p: Problem) {
    setEditingProblem(p);
    setTitle(p.title);
    setDifficulty(p.difficulty);
    setNote(p.note ?? "");
    setUrl(p.url ?? "");
    setSelectedTopics(
      p.topics.flatMap((name) => {
        const m = allTopics.find((t) => t.topic === name);
        return m ? [m.id] : [];
      }),
    );
    setSelectedPatterns(
      p.patterns.flatMap((name) => {
        const m = allPatterns.find((t) => t.pattern === name);
        return m ? [m.id] : [];
      }),
    );
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProblem(null);
  }

  function toggleTopic(id: number) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function togglePattern(id: number) {
    setSelectedPatterns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const token = await getToken();
    const body = {
      title,
      difficulty,
      note: note || null,
      url: url || null,
      topic_ids: selectedTopics,
      pattern_ids: selectedPatterns,
    };
    try {
      if (editingProblem) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/problems/${editingProblem.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          setError(`Request failed: ${res.status}`);
          return;
        }
        const updated = await res.json();
        setProblems(
          (problems ?? []).map((p) =>
            p.id === editingProblem.id ? updated : p,
          ),
        );
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError(`Request failed: ${res.status}`);
          return;
        }
        const created = await res.json();
        setProblems([...(problems ?? []), created]);
        ph?.capture("problem_added", {
          difficulty,
          topics: selectedTopics.length,
          patterns: selectedPatterns.length,
        });
      }
      closeForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProblem(id: number) {
    setDeletingId(id);
    const token = await getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/problems/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      setError(`Request failed: ${res.status}`);
      setDeletingId(null);
      return;
    }
    setProblems((problems ?? []).filter((p) => p.id !== id));
    setDeletingId(null);
  }

  const q = search.toLowerCase();
  const filtered = (problems ?? []).filter((p) => {
    if (diffFilter && p.difficulty !== diffFilter) return false;
    if (
      q &&
      !p.title.toLowerCase().includes(q) &&
      !p.topics.some((t) => t.toLowerCase().includes(q)) &&
      !p.patterns.some((pt) => pt.toLowerCase().includes(q))
    )
      return false;
    return true;
  });

  if (error) return <p className="p-8 text-red-600">{error}</p>;

  if (problems === null)
    return (
      <main className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-36 rounded bg-foreground/10 animate-pulse" />
          <div className="h-9 w-32 rounded-full bg-foreground/10 animate-pulse" />
        </div>
        <div className="h-10 w-full rounded-full bg-foreground/10 animate-pulse mb-4" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-4 animate-pulse"
              style={{
                borderColor: "rgba(49,54,40,0.1)",
                backgroundColor: "var(--surface)",
              }}
            >
              <div className="h-5 w-3/4 rounded bg-foreground/10 mb-2" />
              <div className="h-4 w-1/3 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </main>
    );

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <Suspense fallback={null}>
        <UpgradeBanner />
      </Suspense>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">My Problems</h1>
          {problems.length > 0 && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "rgba(49,54,40,0.08)",
                color: "var(--foreground)",
                opacity: 0.6,
              }}
            >
              {problems.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Calendar sync */}
          <Tooltip content="Sync your review schedule to Google Calendar">
            <button
              onClick={() => handleCalendarSync("google")}
              disabled={!calendarIcsUrl}
              className="flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
              aria-label="Sync to Google Calendar"
            >
              <Image
                src="/google-cal-icon.png"
                alt="Google Calendar"
                width={28}
                height={28}
              />
            </button>
          </Tooltip>
          <Tooltip content="Apple Calendar — coming soon">
            <button
              disabled
              className="flex items-center justify-center opacity-30 cursor-not-allowed"
              aria-label="Apple Calendar coming soon"
            >
              <Image
                src="/apple-cal-icon.png"
                alt="Apple Calendar"
                width={28}
                height={28}
              />
            </button>
          </Tooltip>
          <Tooltip content="Track a new problem — it'll be scheduled for spaced repetition review">
            <button
              data-tour="add-problem"
              onClick={openAddForm}
              className="flex items-center gap-1.5 rounded-full h-9 px-4 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: "var(--foreground)",
                color: "var(--surface)",
              }}
            >
              <FontAwesomeIcon
                icon={faPlus}
                style={{ width: "0.7rem", height: "0.7rem" }}
              />
              Add problem
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Search + difficulty filter */}
      {problems.length > 0 && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div
            className="flex items-center gap-2 flex-1 min-w-[160px] rounded-full border px-3 py-2"
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems"
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: "var(--foreground)" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="cursor-pointer hover:opacity-70 transition-opacity"
              >
                <FontAwesomeIcon
                  icon={faXmark}
                  style={{
                    width: "0.7rem",
                    height: "0.7rem",
                    color: "var(--foreground)",
                    opacity: 0.35,
                  }}
                />
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {(["", "easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDiffFilter(d)}
                className="rounded-full border text-xs px-3 py-1.5 font-medium cursor-pointer transition-all"
                style={{
                  borderColor:
                    diffFilter === d
                      ? d
                        ? DIFF_COLOR[d]
                        : "var(--foreground)"
                      : "rgba(49,54,40,0.15)",
                  color:
                    diffFilter === d
                      ? d
                        ? DIFF_COLOR[d]
                        : "var(--foreground)"
                      : "var(--foreground)",
                  backgroundColor:
                    diffFilter === d
                      ? d
                        ? `${DIFF_COLOR[d]}15`
                        : "rgba(49,54,40,0.06)"
                      : "var(--surface)",
                  opacity: diffFilter === d ? 1 : 0.55,
                }}
              >
                {d === "" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Problem list */}
      {problems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p
            className="text-sm"
            style={{ color: "var(--foreground)", opacity: 0.4 }}
          >
            No problems yet.
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--foreground)", opacity: 0.3 }}
          >
            Click &ldquo;Add problem&rdquo; to get started.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p
          className="text-sm py-8"
          style={{ color: "var(--foreground)", opacity: 0.4 }}
        >
          No results for &ldquo;{search}&rdquo;
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: "rgba(49,54,40,0.1)",
                backgroundColor: "var(--surface)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{p.title}</p>
                    {p.difficulty && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color:
                            DIFF_COLOR[p.difficulty] ?? "var(--foreground)",
                          backgroundColor: `${DIFF_COLOR[p.difficulty] ?? "rgba(49,54,40,0.08)"}18`,
                        }}
                      >
                        {p.difficulty.charAt(0).toUpperCase() +
                          p.difficulty.slice(1)}
                      </span>
                    )}
                  </div>

                  {(p.topics.length > 0 || p.patterns.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.topics.map((t) => (
                        <span
                          key={t}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "rgba(49,54,40,0.07)",
                            color: "var(--foreground)",
                            opacity: 0.7,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                      {p.patterns.map((pt) => (
                        <span
                          key={pt}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "rgba(49,54,40,0.07)",
                            color: "var(--foreground)",
                            opacity: 0.7,
                          }}
                        >
                          {pt}
                        </span>
                      ))}
                    </div>
                  )}

                  {p.note && (
                    <p
                      className="text-xs mt-2 italic"
                      style={{ color: "var(--foreground)", opacity: 0.5 }}
                    >
                      {p.note}
                    </p>
                  )}

                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-2 hover:opacity-80 transition-opacity"
                      style={{
                        color: "var(--accent-dark, var(--foreground))",
                        opacity: 0.6,
                      }}
                    >
                      View problem
                      <FontAwesomeIcon
                        icon={faArrowUpRightFromSquare}
                        style={{ width: "0.6rem", height: "0.6rem" }}
                      />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Tooltip content="Edit problem details">
                    <button
                      onClick={() => openEditForm(p)}
                      className="cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ color: "var(--foreground)", opacity: 0.3 }}
                    >
                      <FontAwesomeIcon
                        icon={faPen}
                        style={{ width: "0.8rem", height: "0.8rem" }}
                      />
                    </button>
                  </Tooltip>
                  <Tooltip content="Remove from your library">
                    <button
                      onClick={() => deleteProblem(p.id)}
                      disabled={deletingId === p.id}
                      className="cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                      style={{ color: "#a20021" }}
                    >
                      <FontAwesomeIcon
                        icon={faTrash}
                        style={{ width: "0.8rem", height: "0.8rem" }}
                      />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 py-10 overflow-y-auto"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={closeForm}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl flex flex-col gap-5 p-8 my-auto"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">
                {editingProblem ? "Edit problem" : "Add problem"}
              </h2>
              <span className="text-xs" style={{ color: "var(--foreground)", opacity: 0.4 }}><span style={{ color: "#ef4444" }}>*</span> required</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--foreground)", opacity: 0.75 }}
              >
                Title <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                placeholder="Two Sum, Valid Palindrome..."
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "rgba(49,54,40,0.18)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--foreground)", opacity: 0.75 }}
              >
                Difficulty <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(difficulty === d ? "" : d)}
                    className="rounded-full border px-4 py-1.5 text-xs font-medium cursor-pointer transition-all"
                    style={{
                      borderColor:
                        difficulty === d
                          ? DIFF_COLOR[d]
                          : "rgba(49,54,40,0.15)",
                      color:
                        difficulty === d ? DIFF_COLOR[d] : "var(--foreground)",
                      backgroundColor:
                        difficulty === d ? `${DIFF_COLOR[d]}15` : "transparent",
                      opacity: difficulty === d ? 1 : 0.5,
                    }}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.75 }}>Topics <span style={{ color: "#ef4444" }}>*</span></label>
              {selectedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTopics.map((id) => {
                    const t = allTopics.find((t) => t.id === id);
                    if (!t) return null;
                    return (
                      <span key={id} className="flex items-center gap-1 rounded-full text-xs px-2.5 py-1" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                        {t.topic}
                        <button type="button" onClick={() => toggleTopic(id)} className="cursor-pointer leading-none hover:opacity-70">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input
                type="text"
                placeholder="Search topics..."
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
                style={{ borderColor: "rgba(49,54,40,0.18)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              />
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {allTopics
                  .filter((t) => !selectedTopics.includes(t.id) && t.topic.toLowerCase().includes(topicSearch.toLowerCase()))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { toggleTopic(t.id); setTopicSearch(""); }}
                      className="rounded-full border text-xs px-2.5 py-1 cursor-pointer transition-all hover:opacity-80"
                      style={{ borderColor: "rgba(49,54,40,0.15)", backgroundColor: "transparent", color: "var(--foreground)", opacity: 0.6 }}
                    >
                      {t.topic}
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--foreground)", opacity: 0.75 }}>Patterns <span style={{ color: "#ef4444" }}>*</span></label>
              {selectedPatterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPatterns.map((id) => {
                    const pt = allPatterns.find((p) => p.id === id);
                    if (!pt) return null;
                    return (
                      <span key={id} className="flex items-center gap-1 rounded-full text-xs px-2.5 py-1" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                        {pt.pattern}
                        <button type="button" onClick={() => togglePattern(id)} className="cursor-pointer leading-none hover:opacity-70">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input
                type="text"
                placeholder="Search patterns..."
                value={patternSearch}
                onChange={(e) => setPatternSearch(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2"
                style={{ borderColor: "rgba(49,54,40,0.18)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
              />
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {allPatterns
                  .filter((pt) => !selectedPatterns.includes(pt.id) && pt.pattern.toLowerCase().includes(patternSearch.toLowerCase()))
                  .map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => { togglePattern(pt.id); setPatternSearch(""); }}
                      className="rounded-full border text-xs px-2.5 py-1 cursor-pointer transition-all hover:opacity-80"
                      style={{ borderColor: "rgba(49,54,40,0.15)", backgroundColor: "transparent", color: "var(--foreground)", opacity: 0.6 }}
                    >
                      {pt.pattern}
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--foreground)", opacity: 0.75 }}
              >
                Note <span style={{ opacity: 0.5 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={note}
                placeholder="Work on brute force first..."
                onChange={(e) => setNote(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "rgba(49,54,40,0.18)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--foreground)", opacity: 0.75 }}
              >
                URL <span style={{ opacity: 0.5 }}>(optional)</span>
              </label>
              <input
                type="url"
                value={url}
                placeholder="https://leetcode.com/problems/two-sum/"
                onChange={(e) => setUrl(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: "rgba(49,54,40,0.18)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity"
                style={{ borderColor: "rgba(49,54,40,0.2)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !title ||
                  !difficulty ||
                  selectedTopics.length === 0 ||
                  selectedPatterns.length === 0
                }
                className="rounded-full h-10 px-5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
                style={{
                  backgroundColor: "var(--foreground)",
                  color: "var(--surface)",
                }}
              >
                {submitting
                  ? "Saving..."
                  : editingProblem
                    ? "Save changes"
                    : "Add problem"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
