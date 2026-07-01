"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

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
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgrade") === "success";
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<number[]>([]);
  const [allTopics, setAllTopics] = useState<{ id: number; topic: string }[]>([]);
  const [allPatterns, setAllPatterns] = useState<{ id: number; pattern: string }[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function loadProblems() {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError(`Request failed: ${res.status}`); return; }
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

    fetchTopics().catch((err) => setError(String(err)));
    fetchPatterns().catch((err) => setError(String(err)));
  }, [isLoaded, isSignedIn, getToken]);

  function openAddForm() {
    setEditingProblem(null);
    setTitle(""); setDifficulty(""); setNote(""); setUrl("");
    setSelectedTopics([]); setSelectedPatterns([]);
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
    const body = { title, difficulty, note: note || null, url: url || null, topic_ids: selectedTopics, pattern_ids: selectedPatterns };

    if (editingProblem) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems/${editingProblem.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(`Request failed: ${res.status}`); return; }
      const updated = await res.json();
      setProblems((problems ?? []).map((p) => (p.id === editingProblem.id ? updated : p)));
    } else {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(`Request failed: ${res.status}`); return; }
      const created = await res.json();
      setProblems([...(problems ?? []), created]);
    }

    closeForm();
  }

  async function deleteProblem(id: number) {
    const token = await getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError(`Request failed: ${res.status}`); return; }
    setProblems((problems ?? []).filter((p) => p.id !== id));
  }

  if (!isLoaded) return <p className="p-8">Loading...</p>;
  if (!isSignedIn) return <p className="p-8">Sign in to see your problems.</p>;
  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (problems === null) return <p className="p-8">Loading your problems...</p>;

  return (
    <main className="p-8 max-w-2xl mx-auto w-full">
      {upgraded && (
        <div className="mb-6 rounded-xl bg-success/20 border border-success/30 px-4 py-3 text-sm font-medium text-foreground">
          🎉 You&apos;re now Pro! Welcome to Lock The Code Pro.
        </div>
      )}
      <h1 className="text-2xl font-semibold mb-6">Your Problems</h1>

      {problems.length === 0 ? (
        <p className="text-foreground/60">No problems yet — add your first one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {problems.map((p) => (
            <li key={p.id} className="rounded-xl border border-foreground/10 p-4 relative">
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => openEditForm(p)} className="text-foreground/40 hover:text-foreground transition-colors cursor-pointer">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteProblem(p.id)} className="text-foreground/40 hover:text-primary transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="font-medium pr-16">{p.title}</p>
              <p className="text-sm text-foreground/60">
                {p.difficulty} · {p.topics.join(", ")} · {p.patterns.join(", ")}
              </p>
              {p.note && <p className="italic text-sm text-foreground/60">Note: {p.note}</p>}
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
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
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-xl border border-foreground/10 p-6">
          <h2 className="font-semibold">{editingProblem ? "Edit Problem" : "Add Problem"}</h2>

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
            <p className="text-xs text-foreground/50">Hold Cmd/Ctrl to select multiple</p>
            <select
              multiple
              value={selectedTopics.map(String)}
              onChange={(e) => setSelectedTopics(Array.from(e.target.selectedOptions, (opt) => Number(opt.value)))}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 h-36"
            >
              {allTopics.map((t) => (
                <option key={t.id} value={t.id}>{t.topic}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Pattern(s)</label>
            <p className="text-xs text-foreground/50">Hold Cmd/Ctrl to select multiple</p>
            <select
              multiple
              value={selectedPatterns.map(String)}
              onChange={(e) => setSelectedPatterns(Array.from(e.target.selectedOptions, (opt) => Number(opt.value)))}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 h-36"
            >
              {allPatterns.map((t) => (
                <option key={t.id} value={t.id}>{t.pattern}</option>
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
            <label className="text-sm font-medium">URL <span className="text-foreground/40 font-normal">(optional)</span></label>
            <input
              type="url"
              value={url}
              placeholder="https://leetcode.com/problems/two-sum/"
              onChange={(e) => setUrl(e.target.value)}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-2 self-end">
            <button type="button" onClick={closeForm} className="rounded-full border border-foreground/20 text-foreground/60 font-medium text-sm h-10 px-6 cursor-pointer hover:opacity-70">
              Cancel
            </button>
            <button type="submit" className="rounded-full bg-primary text-primary-foreground font-medium text-sm h-10 px-6 cursor-pointer transition-opacity hover:opacity-90">
              {editingProblem ? "Update" : "Save"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
