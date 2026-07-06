"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faPaperPlane,
  faStopwatch,
  faStop,
  faPlay,
} from "@fortawesome/free-solid-svg-icons";
import Editor from "@monaco-editor/react";

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

// ── In-browser code execution helpers ─────────────────────────────────────────

// Lazy singleton — loads Pyodide WASM once, reuses on subsequent runs
let pyodidePromise: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
      script.onload = async () => {
        try {
          resolve(await (window as any).loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" })); // eslint-disable-line @typescript-eslint/no-explicit-any
        } catch (e) { reject(e); }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return pyodidePromise;
}

function runJavaScriptInWorker(code: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const src = `self.onmessage=function(e){
      const logs=[];
      const console={
        log:(...a)=>logs.push(a.map(x=>(x!==null&&typeof x==='object')?JSON.stringify(x):String(x)).join(' ')),
        error:(...a)=>logs.push('[err] '+a.map(String).join(' ')),
        warn:(...a)=>logs.push('[warn] '+a.map(String).join(' ')),
        info:(...a)=>logs.push(a.map(String).join(' ')),
      };
      let stderr='';
      try{eval(e.data);self.postMessage({stdout:logs.join('\\n'),stderr,exitCode:0});}
      catch(err){self.postMessage({stdout:logs.join('\\n'),stderr:err.message||String(err),exitCode:1});}
    };`;
    const url = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
    const worker = new Worker(url);
    const timer = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve({ stdout: "", stderr: "Timed out after 10s", exitCode: 1 }); }, 10_000);
    worker.onmessage = (e) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(e.data); };
    worker.onerror  = (e) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve({ stdout: "", stderr: e.message, exitCode: 1 }); };
    worker.postMessage(code);
  });
}

// ──────────────────────────────────────────────────────────────────────────────

const MicIcon = ({ size = "1.25rem" }: { size?: string }) => (
  <FontAwesomeIcon
    icon={faMicrophone}
    style={{ width: size, height: size, color: "var(--accent)" }}
  />
);

type RestoredSession = {
  messages: Message[];
  phase: Phase;
  code: string;
  language: string;
  secondsLeft: number;
  timerStarted: boolean;
};

function parseRestoredSession(): RestoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem("ltc_interview");
    if (!saved) return null;
    const data = JSON.parse(saved);
    const elapsed = (Date.now() - data.leftAt) / 1000;
    if (elapsed > 60) { sessionStorage.removeItem("ltc_interview"); return null; }
    const secondsLeft = Math.max(0, data.secondsLeft - Math.floor(elapsed));
    sessionStorage.removeItem("ltc_interview");
    return {
      messages: data.messages,
      phase: data.phase,
      code: data.code,
      language: data.language,
      secondsLeft,
      timerStarted: secondsLeft > 0,
    };
  } catch {
    sessionStorage.removeItem("ltc_interview");
    return null;
  }
}

export default function InterviewPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  // Lazy-restore from sessionStorage (populated on unmount when interview is active)
  const [_restored] = useState(() => parseRestoredSession());
  const [phase, setPhase] = useState<Phase>(() => _restored?.phase ?? { type: "selecting_problem" });
  const [company, setCompany] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => _restored?.messages ?? []);
  const [input, setInput] = useState("");
  const [code, setCode] = useState(() => _restored?.code ?? "");
  const [language, setLanguage] = useState(() => _restored?.language ?? "python");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() => _restored?.secondsLeft ?? 0);
  const [timerStarted, setTimerStarted] = useState(() => _restored?.timerStarted ?? false);
  const [mobileTab, setMobileTab] = useState<"chat" | "code">("chat");
  const [endConfirm, setEndConfirm] = useState(false);
  const [codeRunning, setCodeRunning] = useState(false);
  const [codeOutput, setCodeOutput] = useState<{ stdout: string; stderr: string; exitCode: number } | null>(null);
  const [showConsole, setShowConsole] = useState(false);

  // Voice input
  const [isListening, setIsListening] = useState(false);
  const [micSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition), // eslint-disable-line @typescript-eslint/no-explicit-any
  );
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const autoSubmitRef = useRef(false);

  // Stable refs so speech callbacks can read current state without stale closures
  const phaseRef = useRef<Phase>({ type: "selecting_problem" });
  const messagesRef = useRef<Message[]>([]);
  const streamingRef = useRef(false);
  const codeRef = useRef("");
  const languageRef = useRef("python");
  const secondsLeftRef = useRef(0);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const mobileChatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resize textarea whenever input changes (handles voice input expanding too)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Save interview state on unmount so user can return within 1 minute
  useEffect(() => {
    return () => {
      if (phaseRef.current.type === "interviewing") {
        try {
          sessionStorage.setItem("ltc_interview", JSON.stringify({
            messages: messagesRef.current,
            phase: phaseRef.current,
            code: codeRef.current,
            language: languageRef.current,
            secondsLeft: secondsLeftRef.current,
            leftAt: Date.now(),
          }));
        } catch {}
      } else {
        sessionStorage.removeItem("ltc_interview");
      }
    };
  }, []);

  // Signal to the layout nav guard that an interview is actively running
  useEffect(() => {
    if (phase.type === "interviewing") {
      sessionStorage.setItem("ltc_interview_running", "1");
    } else {
      sessionStorage.removeItem("ltc_interview_running");
    }
    return () => sessionStorage.removeItem("ltc_interview_running");
  }, [phase.type]);

  // Warn on browser tab close/reload during an active interview
  useEffect(() => {
    if (phase.type !== "interviewing") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase.type]);

  // 5-minute inactivity → end the interview
  function resetInactivity() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      sessionStorage.removeItem("ltc_interview");
      setPhase({ type: "done" });
    }, 5 * 60 * 1000);
  }

  useEffect(() => {
    if (phase.type !== "interviewing") {
      if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
      return;
    }
    resetInactivity();
    return () => { if (inactivityRef.current) clearTimeout(inactivityRef.current); };
  }, [phase.type]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll to bottom on every message update, including mid-stream tokens
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    if (mobileChatScrollRef.current) mobileChatScrollRef.current.scrollTop = mobileChatScrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!timerStarted || secondsLeftRef.current <= 0) return;
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
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally fires only on timer tick

  // ── Voice helpers ──────────────────────────────────────────────────────────

  function startListening() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SR || streamingRef.current) return;

    finalTranscriptRef.current = "";
    autoSubmitRef.current = false;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let newFinal = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) newFinal += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (newFinal) finalTranscriptRef.current += newFinal + " ";
      setInput(finalTranscriptRef.current + interim);

      // Reset 10-second silence timer on each new speech result
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(handleSilenceTimeout, 10_000);
    };

    rec.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (autoSubmitRef.current) {
        const text = finalTranscriptRef.current.trim();
        const p = phaseRef.current;
        if (text && !streamingRef.current && p.type === "interviewing") {
          streamMessage(messagesRef.current, p.level, p.company, p.timeLimit, text);
        }
      }
    };

    rec.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.error !== "aborted") {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);

    // Start initial silence timer (in case user never speaks)
    silenceTimerRef.current = setTimeout(handleSilenceTimeout, 10_000);
  }

  function handleSilenceTimeout() {
    autoSubmitRef.current = true;
    recognitionRef.current?.stop();
  }

  function handleStopAndSubmit() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    autoSubmitRef.current = true;
    recognitionRef.current?.stop();
  }

  function handleStopOnly() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    autoSubmitRef.current = false;
    recognitionRef.current?.stop();
  }

  // ── Interview logic ────────────────────────────────────────────────────────

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
    const codeBlock =
      code.trim() && userText !== null
        ? `\n\n[My code — ${language}]\n\`\`\`${language}\n${code.trim()}\n\`\`\``
        : "";

    const apiMessages: Message[] =
      userText === null
        ? [{ role: "user", content: "Let's begin the interview!" }]
        : [...history, { role: "user", content: userText + codeBlock }];

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
      resetInactivity();
    }
  }

  async function runCode() {
    if (!code.trim() || codeRunning) return;
    setCodeRunning(true);
    setShowConsole(true);
    setCodeOutput(null);
    try {
      if (language === "python") {
        // Free in-browser execution via Pyodide WebAssembly
        let stdout = "";
        let stderr = "";
        const py = await getPyodide();
        py.setStdout({ batched: (t: string) => { stdout += t + "\n"; } });
        py.setStderr({ batched: (t: string) => { stderr += t + "\n"; } });
        try {
          await py.runPythonAsync(code);
          setCodeOutput({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 });
        } catch (e: unknown) {
          setCodeOutput({ stdout: stdout.trim(), stderr: e instanceof Error ? e.message : String(e), exitCode: 1 });
        }
      } else if (language === "javascript") {
        // Free in-browser execution via sandboxed Web Worker
        const result = await runJavaScriptInWorker(code);
        setCodeOutput(result);
      } else {
        // Cloud execution via Judge0 — requires JUDGE0_API_KEY on the backend
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/execute`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ language, code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCodeOutput({ stdout: "", stderr: data.detail ?? `Cloud execution not configured for ${language}`, exitCode: 1 });
          return;
        }
        setCodeOutput({ stdout: data.stdout, stderr: data.stderr, exitCode: data.exit_code });
      }
    } catch (e) {
      setCodeOutput({ stdout: "", stderr: String(e), exitCode: 1 });
    } finally {
      setCodeRunning(false);
    }
  }

  function endInterview() {
    setEndConfirm(false);
    if (phase.type !== "interviewing") return;
    streamMessage(
      messages,
      phase.level,
      phase.company,
      phase.timeLimit,
      "I'd like to end the interview now and move to the feedback session.",
    );
  }

  function handleSend() {
    if (!input.trim() || streaming || phase.type !== "interviewing") return;
    if (isListening) handleStopOnly();
    streamMessage(
      messages,
      phase.level,
      phase.company,
      phase.timeLimit,
      input.trim(),
    );
  }

if (!isLoaded || !isSignedIn) return <p className="p-8">Loading...</p>;

  // ── Select problem source ────────────────────────────────────────────────
  if (phase.type === "selecting_problem") {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto flex flex-col gap-6">
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
      <div className="p-4 sm:p-8 max-w-xl mx-auto flex flex-col gap-6">
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
      <div className="p-4 sm:p-8 max-w-xl mx-auto flex flex-col gap-6">
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

  // ── Inactivity ended the interview ──────────────────────────────────────
  if (phase.type === "done") {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto flex flex-col gap-6 items-center text-center">
        <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center">
          <MicIcon size="1.5rem" />
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-2">Interview ended</h1>
          <p className="text-foreground/60 text-sm">
            The session ended after 5 minutes of inactivity.
          </p>
        </div>
        <button
          onClick={() => { setMessages([]); setCode(""); setPhase({ type: "selecting_problem" }); }}
          className="rounded-full bg-primary text-primary-foreground text-sm font-medium px-6 py-2.5 cursor-pointer transition-opacity hover:opacity-90"
        >
          Start a new interview
        </button>
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

  const inputDisabled = streaming || secondsLeft === 0;

  const ChatMessages = (
    <>
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
            {m.content || (streaming && i === messages.length - 1 ? "▌" : "")}
          </div>
        </div>
      ))}
      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </>
  );

  const ChatInput = (
    <div className="border-t border-foreground/10 px-3 py-3 flex gap-2 shrink-0 items-end">
      <textarea
        ref={inputRef}
        rows={1}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            if (inputRef.current) inputRef.current.style.height = "auto";
          }
        }}
        placeholder={isListening ? "Listening..." : "Reply to interviewer..."}
        disabled={inputDisabled}
        className="flex-1 rounded-2xl border border-foreground/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 resize-none overflow-hidden"
        style={{ maxHeight: "120px" }}
      />

      {/* Mic button */}
      {micSupported && (
        <>
          {isListening ? (
            <>
              {/* Pulsing mic — click to cancel without submitting */}
              <button
                onClick={handleStopOnly}
                title="Cancel recording"
                className="relative w-9 h-9 flex items-center justify-center rounded-full shrink-0 cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: "var(--primary)" }} />
                <FontAwesomeIcon
                  icon={faMicrophone}
                  style={{ width: "0.875rem", height: "0.875rem", color: "white" }}
                />
              </button>
              {/* Stop & Submit */}
              <button
                onClick={handleStopAndSubmit}
                disabled={!finalTranscriptRef.current.trim() && !input.trim()}
                title="Stop speaking and submit"
                className="flex items-center gap-1.5 rounded-full px-3 h-9 text-xs font-medium shrink-0 cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "var(--primary)", color: "white" }}
              >
                <FontAwesomeIcon icon={faStop} style={{ width: "0.7rem", height: "0.7rem" }} />
                Submit
              </button>
            </>
          ) : (
            <button
              onClick={startListening}
              disabled={inputDisabled}
              title="Speak your answer"
              className="w-9 h-9 flex items-center justify-center rounded-full border border-foreground/20 shrink-0 cursor-pointer hover:border-foreground/50 transition-colors disabled:opacity-40"
            >
              <FontAwesomeIcon
                icon={faMicrophone}
                style={{ width: "0.875rem", height: "0.875rem", color: "var(--accent)" }}
              />
            </button>
          )}
        </>
      )}

      {/* Send button — hidden while listening, use Submit instead */}
      {!isListening && (
        <button
          onClick={handleSend}
          disabled={!input.trim() || inputDisabled}
          className="rounded-full bg-primary text-primary-foreground w-9 h-9 flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <FontAwesomeIcon
            icon={faPaperPlane}
            style={{ width: "0.875rem", height: "0.875rem" }}
          />
        </button>
      )}
    </div>
  );

  const LANGUAGES = ["python", "javascript", "typescript", "java", "cpp", "go"];

  const CodePanel = (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "#1e1e1e" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ background: "#252526", borderBottom: "1px solid #3c3c3c" }}
      >
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="text-xs font-mono focus:outline-none cursor-pointer"
          style={{ background: "#3c3c3c", color: "#cccccc", border: "none", borderRadius: "3px", padding: "2px 6px" }}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={runCode}
          disabled={codeRunning || !code.trim()}
          className="flex items-center gap-1 text-xs rounded px-2 py-0.5 cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-80 ml-auto"
          style={{ background: "#0e7a0d", color: "white" }}
        >
          <FontAwesomeIcon icon={faPlay} style={{ width: "0.55rem", height: "0.55rem" }} />
          {codeRunning ? "Running…" : "Run"}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden min-h-0">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val ?? "")}
          options={{
            fontSize: 13,
            fontFamily: "Consolas, 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            wordWrap: "on",
            tabSize: 4,
            padding: { top: 12 },
            overviewRulerLanes: 0,
          }}
        />
      </div>

      {/* Console */}
      {showConsole && (
        <div className="shrink-0 flex flex-col" style={{ borderTop: "1px solid #3c3c3c", maxHeight: "200px" }}>
          <div
            className="flex items-center justify-between px-3 py-1 shrink-0"
            style={{ background: "#252526", borderBottom: "1px solid #3c3c3c" }}
          >
            <span className="text-xs font-medium" style={{ color: "#cccccc" }}>Console</span>
            <div className="flex items-center gap-3">
              {codeOutput && (
                <span className="text-xs font-mono" style={{ color: codeOutput.exitCode === 0 ? "#4ec9b0" : "#f48771" }}>
                  exit {codeOutput.exitCode}
                </span>
              )}
              <button
                onClick={() => setShowConsole(false)}
                className="text-xs cursor-pointer hover:opacity-60 transition-opacity"
                style={{ color: "#858585" }}
              >
                ✕
              </button>
            </div>
          </div>
          <div
            className="overflow-y-auto p-3 font-mono text-xs"
            style={{ background: "#1e1e1e", color: "#cccccc", minHeight: "72px", maxHeight: "160px" }}
          >
            {codeRunning ? (
              <span style={{ color: "#858585" }}>Running…</span>
            ) : codeOutput ? (
              <>
                {codeOutput.stdout && <pre className="whitespace-pre-wrap">{codeOutput.stdout}</pre>}
                {codeOutput.stderr && <pre className="whitespace-pre-wrap" style={{ color: "#f48771" }}>{codeOutput.stderr}</pre>}
                {!codeOutput.stdout && !codeOutput.stderr && (
                  <span style={{ color: "#858585" }}>No output</span>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-foreground/10 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        <FontAwesomeIcon
          icon={faMicrophone}
          style={{ width: "1rem", height: "1rem", color: "var(--accent)" }}
        />
        <span className="text-sm font-medium">Mock Interview</span>
        <span className="text-sm text-foreground/40">·</span>
        <span className="text-sm text-foreground/60 truncate max-w-[90px] sm:max-w-none">
          {phase.level}
        </span>
        {phase.company !== "any company" && (
          <>
            <span className="hidden sm:inline text-sm text-foreground/40">·</span>
            <span className="hidden sm:inline text-sm text-foreground/60 truncate">
              {phase.company}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setEndConfirm(true)}
            disabled={streaming}
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-foreground/20 cursor-pointer hover:border-foreground/40 transition-colors disabled:opacity-40 shrink-0"
          >
            End interview
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

      {/* Mobile tab switcher */}
      <div className="md:hidden flex border-b border-foreground/10 shrink-0">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            mobileTab === "chat"
              ? "text-foreground border-b-2 border-primary -mb-px"
              : "text-foreground/40"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setMobileTab("code")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            mobileTab === "code"
              ? "text-foreground border-b-2 border-primary -mb-px"
              : "text-foreground/40"
          }`}
        >
          Code
        </button>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
        {mobileTab === "chat" ? (
          <>
            <div ref={mobileChatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {ChatMessages}
            </div>
            {ChatInput}
          </>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {CodePanel}
          </div>
        )}
      </div>

      {/* Desktop layout — always split */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex flex-col w-1/2 border-r border-foreground/10">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {ChatMessages}
          </div>
          {ChatInput}
        </div>
        <div className="w-1/2 flex flex-col">{CodePanel}</div>
      </div>

      {/* End interview confirm modal */}
      {endConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setEndConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-5"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">End interview?</h2>
              <p className="text-sm text-foreground/60">
                Are you sure you want to end the interview now? The AI will move
                straight to the feedback session.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEndConfirm(false)}
                className="flex-1 rounded-full border border-foreground/20 text-sm font-medium py-2.5 cursor-pointer hover:border-foreground/40 transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={endInterview}
                className="flex-1 rounded-full bg-primary text-primary-foreground text-sm font-medium py-2.5 cursor-pointer hover:opacity-90 transition-opacity"
              >
                End interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
