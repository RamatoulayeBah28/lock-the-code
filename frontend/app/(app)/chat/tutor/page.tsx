"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

type Step =
  | { type: "selecting_problem" }
  | { type: "selecting_help"; problem: string; problemUrl?: string }
  | {
      type: "chatting";
      problem: string;
      helpLevel: string;
      problemUrl?: string;
    };

type Message = { role: "user" | "assistant"; content: string };

const HELP_OPTIONS = [
  {
    id: "walk",
    label: "Walk me through it",
    description: "Guide me step by step from the beginning",
  },
  {
    id: "hints",
    label: "Hints on demand",
    description: "I'll attempt it first, give me hints only when I ask",
  },
];

const BotIcon = () => (
  <FontAwesomeIcon
    icon={faRobot}
    style={{ width: "1.25rem", height: "1.25rem", color: "var(--accent)" }}
  />
);

export default function TutorPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [step, setStep] = useState<Step>({ type: "selecting_problem" });
  const [customProblem, setCustomProblem] = useState("");
  const [todayProblem, setTodayProblem] = useState<{
    title: string;
    url: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function fetchToday() {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/problems/today`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const p = await res.json();
        if (p) setTodayProblem({ title: p.title, url: p.url ?? null });
      }
    }
    fetchToday();
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function startChat(
    problem: string,
    helpLevel: string,
    problemUrl?: string,
  ) {
    setStep({ type: "chatting", problem, helpLevel, problemUrl });
    await streamMessage([], problem, helpLevel, null, problemUrl);
  }

  async function streamMessage(
    history: Message[],
    problem: string,
    helpLevel: string,
    userText: string | null,
    problemUrl?: string,
  ) {
    // Anthropic requires at least one message; use a silent trigger for the opening greeting
    const apiMessages: Message[] =
      userText === null
        ? [{ role: "user", content: "Hi, I am ready to start!" }]
        : [...history, { role: "user", content: userText }];

    if (userText !== null) {
      setMessages([...history, { role: "user", content: userText }]);
      setInput("");
    }

    setStreaming(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "tutor",
          messages: apiMessages,
          context: {
            problem,
            help_level: helpLevel,
            problem_url: problemUrl ?? "",
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Something went wrong");
        setStreaming(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const text = JSON.parse(data).text as string;
            setMessages((prev) => [
              ...prev.slice(0, -1),
              {
                role: "assistant",
                content: (prev[prev.length - 1]?.content ?? "") + text,
              },
            ]);
          } catch {}
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setStreaming(false);
    }
  }

  function handleSend() {
    if (!input.trim() || streaming || step.type !== "chatting") return;
    streamMessage(
      messages,
      step.problem,
      step.helpLevel,
      input.trim(),
      step.problemUrl,
    );
  }

  // if (!isLoaded || !isSignedIn) return <p className="p-8">Loading...</p>;

  // ── Setup: pick problem ─────────────────────────────────────────────────
  if (step.type === "selecting_problem") {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <BotIcon />
          <h1 className="text-2xl font-semibold">Ask Your AI Tutor</h1>
        </div>
        <p className="text-foreground/60">
          Which problem do you want to tackle today?
        </p>
        <div className="flex flex-col gap-3">
          {todayProblem && (
            <button
              onClick={() =>
                setStep({
                  type: "selecting_help",
                  problem: todayProblem!.title,
                  problemUrl: todayProblem!.url ?? undefined,
                })
              }
              className="rounded-xl border border-foreground/10 p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <p className="font-medium">Today&apos;s review problem</p>
              <p className="text-sm text-foreground/60 mt-0.5">
                {todayProblem!.title}
              </p>
            </button>
          )}
          <button
            onClick={() => setStep({ type: "selecting_help", problem: "" })}
            className="rounded-xl border border-foreground/10 p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
          >
            <p className="font-medium">
              A specific problem (I&apos;ll type it)
            </p>
          </button>
        </div>
        {!todayProblem && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Problem name or description..."
              value={customProblem}
              onChange={(e) => setCustomProblem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customProblem.trim())
                  setStep({
                    type: "selecting_help",
                    problem: customProblem.trim(),
                  });
              }}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              disabled={!customProblem.trim()}
              onClick={() =>
                setStep({
                  type: "selecting_help",
                  problem: customProblem.trim(),
                })
              }
              className="rounded-full bg-primary text-primary-foreground text-sm font-medium h-10 px-6 cursor-pointer transition-opacity hover:opacity-90 self-end disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Setup: type problem name ─────────────────────────────────────────────
  if (step.type === "selecting_help" && !step.problem) {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <BotIcon />
          <h1 className="text-2xl font-semibold">Which problem?</h1>
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="e.g. Two Sum, Valid Parentheses..."
            value={customProblem}
            onChange={(e) => setCustomProblem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customProblem.trim())
                setStep({
                  type: "selecting_help",
                  problem: customProblem.trim(),
                });
            }}
            autoFocus
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            disabled={!customProblem.trim()}
            onClick={() =>
              setStep({ type: "selecting_help", problem: customProblem.trim() })
            }
            className="rounded-full bg-primary text-primary-foreground text-sm font-medium h-10 px-6 cursor-pointer transition-opacity hover:opacity-90 self-end disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── Setup: pick help level ───────────────────────────────────────────────
  if (step.type === "selecting_help") {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <BotIcon />
          <h1 className="text-2xl font-semibold">How much help do you want?</h1>
        </div>
        <p className="text-sm text-foreground/60">
          Problem:{" "}
          <span className="font-medium text-foreground">{step.problem}</span>
        </p>
        <div className="flex flex-col gap-3">
          {HELP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() =>
                startChat(
                  step.problem,
                  opt.label + " — " + opt.description,
                  step.problemUrl,
                )
              }
              className="rounded-xl border border-foreground/10 p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-sm text-foreground/60 mt-0.5">
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-foreground/10 px-6 py-3 flex items-center gap-2 shrink-0">
        <FontAwesomeIcon
          icon={faRobot}
          style={{ width: "1rem", height: "1rem", color: "var(--accent)" }}
        />
        <span className="text-sm font-medium">AI Tutor</span>
        <span className="text-sm text-foreground/40 mx-2">·</span>
        <span className="text-sm text-foreground/60 truncate">
          {step.problem}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/5 text-foreground"
              }`}
            >
              {m.content || (streaming && i === messages.length - 1 ? "▌" : "")}
            </div>
          </div>
        ))}
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-foreground/10 px-4 py-3 flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          disabled={streaming}
          className="flex-1 rounded-full border border-foreground/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          className="rounded-full bg-primary text-primary-foreground w-9 h-9 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <FontAwesomeIcon
            icon={faPaperPlane}
            style={{ width: "0.875rem", height: "0.875rem" }}
          />
        </button>
      </div>
    </div>
  );
}
