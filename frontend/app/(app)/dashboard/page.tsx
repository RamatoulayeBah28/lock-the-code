"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";

function UpgradeBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("upgrade") !== "success") return null;
  return (
    <div className="mb-6 rounded-xl bg-success/20 border border-success/30 px-4 py-3 text-sm font-medium text-foreground">
      ❤︎ You&apos;re now Pro! Welcome to Lock The Code Pro. ❤︎
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

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function loadProblems() {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(`Request failed: ${res.status}`);
        return;
      }
      setProblems(await res.json());
    }

    loadProblems().catch((err) => setError(String(err)));
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function fetchTopics() {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllTopics(await res.json());
    }

    async function fetchPatterns() {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/patterns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllPatterns(await res.json());
    }

    async function fetchCalendarToken() {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calendar/token`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { token: calToken, user_id } = await res.json();
      setCalendarIcsUrl(
        `${process.env.NEXT_PUBLIC_API_URL}/calendar/${user_id}/${calToken}.ics`,
      );
    }

    fetchTopics().catch((err) => setError(String(err)));
    fetchPatterns().catch((err) => setError(String(err)));
    fetchCalendarToken().catch(() => {});
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
      window.open(webcalUrl, "_blank");
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
        const match = allTopics.find((t) => t.topic === name);
        return match ? [match.id] : [];
      }),
    );
    setSelectedPatterns(
      p.patterns.flatMap((name) => {
        const match = allPatterns.find((t) => t.pattern === name);
        return match ? [match.id] : [];
      }),
    );
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProblem(null);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const token = await getToken();
    const body = {
      title,
      difficulty,
      note: note || null,
      url: url || null,
      topic_ids: selectedTopics,
      pattern_ids: selectedPatterns,
    };

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
        (problems ?? []).map((p) => (p.id === editingProblem.id ? updated : p)),
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

  if (!isLoaded) return <p className="p-8">Loading...</p>;
  if (!isSignedIn) return <p className="p-8">Sign in to see your problems.</p>;
  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (problems === null)
    return (
      <main className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-36 rounded bg-foreground/10 animate-pulse" />
          <div className="h-9 w-40 rounded-full bg-foreground/10 animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-foreground/10 p-4">
              <div className="h-5 w-3/4 rounded bg-foreground/10 animate-pulse mb-2" />
              <div className="h-4 w-1/2 rounded bg-foreground/10 animate-pulse" />
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your Problems</h1>
        <div className="flex items-center gap-2">
          {/* Google Calendar */}
          <div className="relative group">
            <button
              onClick={() => handleCalendarSync("google")}
              disabled={!calendarIcsUrl}
              className="flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
              aria-label="Sync to Google Calendar"
            >
              <Image
                src="/google-cal-icon.png"
                alt="Google Calendar"
                width={32}
                height={32}
              />
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-foreground text-surface rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Sync to Google Calendar
            </span>
          </div>
          {/* Apple Calendar */}
          <div className="relative group">
            <button
              onClick={() => handleCalendarSync("apple")}
              disabled={!calendarIcsUrl}
              className="flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
              aria-label="Sync to Apple Calendar"
            >
              <Image
                src="/apple-cal-icon.png"
                alt="Apple Calendar"
                width={32}
                height={32}
              />
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-foreground text-surface rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Sync to Apple Calendar
            </span>
          </div>
        </div>
      </div>

      {problems.length === 0 ? (
        <p className="text-foreground/60">
          No problems yet — add your first one to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {problems.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-foreground/10 p-4 relative"
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => openEditForm(p)}
                  className="text-foreground/40 hover:text-foreground transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon
                    icon={faPen}
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "var(--success)",
                    }}
                  />
                </button>
                <button
                  onClick={() => deleteProblem(p.id)}
                  disabled={deletingId === p.id}
                  className="text-foreground/40 hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon
                    icon={faTrash}
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "var(--primary)",
                    }}
                  />
                </button>
              </div>
              <p className="font-medium pr-16">{p.title}</p>
              <p className="text-sm text-foreground/60">
                {p.difficulty} · {p.topics.join(", ")} · {p.patterns.join(", ")}
              </p>
              {p.note && (
                <p className="italic text-sm text-foreground/60">
                  Note: {p.note}
                </p>
              )}
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View problem ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        className="rounded-full bg-primary mt-4 text-primary-foreground font-medium text-base h-12 px-8 cursor-pointer transition-opacity hover:opacity-90"
        onClick={openAddForm}
      >
        Add Problem
      </button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-4 rounded-xl border border-foreground/10 p-6"
        >
          <h2 className="font-semibold">
            {editingProblem ? "Edit Problem" : "Add Problem"}
          </h2>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              placeholder="Two Sum, Valid Palindrome..."
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Topic(s)</label>
            <p className="text-xs text-foreground/50">
              Hold Cmd/Ctrl to select multiple
            </p>
            <select
              multiple
              value={selectedTopics.map(String)}
              onChange={(e) =>
                setSelectedTopics(
                  Array.from(e.target.selectedOptions, (opt) =>
                    Number(opt.value),
                  ),
                )
              }
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 h-36"
            >
              {allTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Pattern(s)</label>
            <p className="text-xs text-foreground/50">
              Hold Cmd/Ctrl to select multiple
            </p>
            <select
              multiple
              value={selectedPatterns.map(String)}
              onChange={(e) =>
                setSelectedPatterns(
                  Array.from(e.target.selectedOptions, (opt) =>
                    Number(opt.value),
                  ),
                )
              }
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 h-36"
            >
              {allPatterns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.pattern}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Note</label>
            <input
              type="text"
              value={note}
              placeholder="Work on brute force first..."
              onChange={(e) => setNote(e.target.value)}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              URL{" "}
              <span className="text-foreground/40 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={url}
              placeholder="https://leetcode.com/problems/two-sum/"
              onChange={(e) => setUrl(e.target.value)}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-2 self-end">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full border border-foreground/20 text-foreground/60 font-medium text-sm h-10 px-6 cursor-pointer hover:opacity-70"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-primary text-primary-foreground font-medium text-sm h-10 px-6 cursor-pointer transition-opacity hover:opacity-90"
            >
              {editingProblem ? "Update" : "Save"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
