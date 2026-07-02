"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faPaperPlane,
  faStopwatch,
  faCode,
} from "@fortawesome/free-solid-svg-icons";

const LEVELS = [
  { id: "Intern", label: "Intern" },
  { id: "New Grad / Junior", label: "New Grad / Junior" },
  { id: "Mid-level", label: "Mid-level" },
  { id: "Senior", label: "Senior" },
  { id: "Staff / Principal", label: "Staff / Principal" },
];

const TIME_BY_LEVEL: Record<string, number> = {
  Intern: 15,
  "New Grad / Junior": 20,
  "Mid-level": 25,
  Senior: 30,
  "Staff / Principal": 35,
};

type Phase =
  | { type: "selecting_problem" }
  | { type: "selecting_level"; problemChoice: "list" | "random" }
  | {
      type: "selecting_company";
      level: string;
      problemChoice: "list" | "random";
    }
  | { type: "interviewing"; level: string; company: string; timeLimit: number }
  | { type: "done" };

type Message = { role: "user" | "assistant"; content: string };

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MicIcon = ({ size = "1.25rem" }: { size?: string }) => (
  <FontAwesomeIcon
    icon={faMicrophone}
    style={{ width: size, height: size, color: "var(--accent)" }}
  />
);

export default function InterviewPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [phase, setPhase] = useState<Phase>({ type: "selecting_problem" });
  const [company, setCompany] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!timerStarted || secondsLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [timerStarted]);

  useEffect(() => {
    if (secondsLeft === 0 && timerStarted && phase.type === "interviewing") {
      streamMessage(
        messages,
        phase.level,
        phase.company,
        phase.timeLimit,
        "Time's up! Please start the feedback session now.",
      );
    }
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startInterview(
    level: string,
    companyChoice: string,
    problemChoice: "list" | "random",
  ) {
    const timeLimit = TIME_BY_LEVEL[level] ?? 25;

    let problemText = `A random ${level}-appropriate LeetCode-style coding problem`;
    let problemUrl = "";

    if (problemChoice === "list") {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/problems`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const problems = await res.json();
          if (problems.length > 0) {
            const pick = problems[Math.floor(Math.random() * problems.length)];
            problemText = pick.title;
            problemUrl = pick.url ?? "";
          }
        }
      } catch {}
    }

    const ctx = {
      level,
      company: companyChoice,
      problem: problemText,
      problem_url: problemUrl,
      time_limit: timeLimit,
    };

    setPhase({
      type: "interviewing",
      level,
      company: companyChoice,
      timeLimit,
    });
    setSecondsLeft(timeLimit * 60);
    setTimerStarted(true);
    await streamMessage([], level, companyChoice, timeLimit, null, ctx);
  }

  async function streamMessage(
    history: Message[],
    level: string,
    comp: string,
    timeLimit: number,
    userText: string | null,
    contextOverride?: object,
  ) {
    // null = initial greeting trigger; Anthropic requires at least one message
    const apiMessages: Message[] =
      userText === null
        ? [{ role: "user", content: "Let's begin the interview!" }]
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
          mode: "interview",
          messages: apiMessages,
          context: contextOverride ?? {
            level,
            company: comp,
            time_limit: timeLimit,
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
    if (!input.trim() || streaming || phase.type !== "interviewing") return;
    streamMessage(
      messages,
      phase.level,
      phase.company,
      phase.timeLimit,
      input.trim(),
    );
  }

  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setCode(code.substring(0, start) + "    " + code.substring(end));
      setTimeout(() => el.setSelectionRange(start + 4, start + 4), 0);
    }
  }

  if (!isLoaded || !isSignedIn) return <p className="p-8">Loading...</p>;

  // ── Select problem source ────────────────────────────────────────────────
  if (phase.type === "selecting_problem") {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <MicIcon />
          <h1 className="text-2xl font-semibold">Simulate a Real Interview</h1>
        </div>
        <p className="text-foreground/60">What kind of problem do you want?</p>
        <div className="flex flex-col gap-3">
          {[
            {
              id: "list" as const,
              label: "Random problem from my saved list",
              desc: "The AI will pick one appropriate for your level",
            },
            {
              id: "random" as const,
              label: "Completely random problem",
              desc: "The AI chooses any well-known coding problem",
            },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() =>
                setPhase({ type: "selecting_level", problemChoice: opt.id })
              }
              className="rounded-xl border border-foreground/10 p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-sm text-foreground/60 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Select level ────────────────────────────────────────────────────────
  if (phase.type === "selecting_level") {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <MicIcon />
          <h1 className="text-2xl font-semibold">
            What level are you targeting?
          </h1>
        </div>
        <div className="flex flex-col gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() =>
                setPhase({
                  type: "selecting_company",
                  level: l.id,
                  problemChoice: phase.problemChoice,
                })
              }
              className="rounded-xl border border-foreground/10 p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <p className="font-medium">{l.label}</p>
              <p className="text-xs text-foreground/40 mt-0.5">
                {TIME_BY_LEVEL[l.id]} min
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Select company ──────────────────────────────────────────────────────
  if (phase.type === "selecting_company") {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <MicIcon />
          <h1 className="text-2xl font-semibold">Any specific company?</h1>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() =>
              startInterview(phase.level, "any company", phase.problemChoice)
            }
            className="rounded-xl border border-foreground/10 p-4 text-left hover:border-foreground/30 transition-colors cursor-pointer"
          >
            <p className="font-medium">Nah bro, I just want a job 😅</p>
            <p className="text-sm text-foreground/60 mt-0.5">
              General interview prep
            </p>
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Google, Meta, Amazon..."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && company.trim())
                  startInterview(
                    phase.level,
                    company.trim(),
                    phase.problemChoice,
                  );
              }}
              className="flex-1 rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              disabled={!company.trim()}
              onClick={() =>
                startInterview(phase.level, company.trim(), phase.problemChoice)
              }
              className="rounded-full bg-primary text-primary-foreground text-sm font-medium px-5 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Interview ────────────────────────────────────────────────────────────
  if (phase.type !== "interviewing") return null;

  const timerColor =
    secondsLeft < 120
      ? "text-red-500"
      : secondsLeft < 300
        ? "text-yellow-600"
        : "text-success";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-foreground/10 px-6 py-3 flex items-center gap-3 shrink-0">
        <FontAwesomeIcon
          icon={faMicrophone}
          style={{ width: "1rem", height: "1rem", color: "var(--accent)" }}
        />
        <span className="text-sm font-medium">Mock Interview</span>
        <span className="text-sm text-foreground/40">·</span>
        <span className="text-sm text-foreground/60">{phase.level}</span>
        {phase.company !== "any company" && (
          <>
            <span className="text-sm text-foreground/40">·</span>
            <span className="text-sm text-foreground/60">{phase.company}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowCode((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <FontAwesomeIcon
              icon={faCode}
              style={{ width: "0.875rem", height: "0.875rem" }}
            />
            {showCode ? "Hide" : "Code"}
          </button>
          <div
            className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${timerColor}`}
          >
            <FontAwesomeIcon
              icon={faStopwatch}
              style={{ width: "1rem", height: "1rem" }}
            />
            {secondsLeft === 0 ? "Time's up" : formatTime(secondsLeft)}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col ${showCode ? "w-1/2" : "flex-1"} border-r border-foreground/10`}
        >
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground/5 text-foreground"
                  }`}
                >
                  {m.content ||
                    (streaming && i === messages.length - 1 ? "▌" : "")}
                </div>
              </div>
            ))}
            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-foreground/10 px-3 py-3 flex gap-2 shrink-0">
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
              placeholder="Reply to interviewer..."
              disabled={streaming || secondsLeft === 0}
              className="flex-1 rounded-full border border-foreground/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming || secondsLeft === 0}
              className="rounded-full bg-primary text-primary-foreground w-9 h-9 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <FontAwesomeIcon
                icon={faPaperPlane}
                style={{ width: "0.875rem", height: "0.875rem" }}
              />
            </button>
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 border-b border-foreground/10 text-xs text-foreground/40 font-mono">
            code editor
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleCodeKeyDown}
            spellCheck={false}
            placeholder="// Write your solution here..."
            className="flex-1 resize-none p-4 font-mono text-sm focus:outline-none bg-foreground/[0.02]"
            style={{ tabSize: 4 }}
          />
        </div>
      </div>
    </div>
  );
}
