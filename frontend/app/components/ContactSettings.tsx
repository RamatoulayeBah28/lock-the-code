"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

export default function ContactSettings() {
  const { getToken } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setStatus("sending");
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
    resize: "none" as const,
  };

  if (status === "sent") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Contact Us</h2>
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "20px" }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: "14px", color: "#15803d" }}>Message sent!</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#16a34a" }}>
            We&apos;ll reply to your email as soon as we can.
          </p>
        </div>
        <button
          onClick={() => { setStatus("idle"); setSubject(""); setMessage(""); }}
          style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: "9999px", border: "none", background: "#313628", color: "white", fontWeight: 500, fontSize: "14px", cursor: "pointer" }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Contact Us</h2>
      <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
        Have a question or feedback? We&apos;d love to hear from you. We reply within 24 hours.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontWeight: 500, fontSize: "14px" }}>Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Question about Pro plan"
          required
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontWeight: 500, fontSize: "14px" }}>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's on your mind…"
          required
          rows={5}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          type="submit"
          disabled={status === "sending" || !subject.trim() || !message.trim()}
          style={{
            padding: "8px 20px",
            borderRadius: "9999px",
            border: "none",
            background: "#313628",
            color: "white",
            fontWeight: 500,
            fontSize: "14px",
            cursor: status === "sending" || !subject.trim() || !message.trim() ? "default" : "pointer",
            opacity: status === "sending" || !subject.trim() || !message.trim() ? 0.5 : 1,
          }}
        >
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
        {status === "error" && (
          <span style={{ fontSize: "13px", color: "#dc2626" }}>Failed to send — please try again.</span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
        You can also reach us directly at{" "}
        <a href="mailto:contact@lockthecode.net" style={{ color: "#6b7280" }}>
          contact@lockthecode.net
        </a>
      </p>
    </form>
  );
}
