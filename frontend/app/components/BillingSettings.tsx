"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

type Me = { is_pro: boolean; subscription_status: string | null };

export default function BillingSettings() {
  const { getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setMe(await res.json());
      } catch {}
      setLoading(false);
    }
    load();
  }, [getToken]);

  async function openPortal() {
    setRedirecting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Something went wrong."); setRedirecting(false); return; }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal.");
      setRedirecting(false);
    }
  }

  const labelStyle: React.CSSProperties = { fontWeight: 500, fontSize: "14px" };
  const mutedStyle: React.CSSProperties = { margin: 0, fontSize: "13px", color: "#6b7280" };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Billing</h2>
        <p style={mutedStyle}>Loading…</p>
      </div>
    );
  }

  const isPro = me?.is_pro ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Billing</h2>

      {/* Current plan */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "20px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <p style={labelStyle}>Current plan</p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: 600,
            background: isPro ? "#313628" : "rgba(0,0,0,0.06)",
            color: isPro ? "#fcb97d" : "#6b7280",
          }}>
            {isPro ? "Pro" : "Free"}
          </span>
        </div>
        {!isPro && (
          <p style={mutedStyle}>Upgrade to Pro to unlock the AI Tutor, Interview Simulator, and unlimited flashcards.</p>
        )}
      </div>

      {/* Action */}
      {isPro ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={labelStyle}>Manage subscription</p>
          <p style={mutedStyle}>Update your payment method, download invoices, or cancel your plan.</p>
          <button
            onClick={openPortal}
            disabled={redirecting}
            style={{
              marginTop: "8px",
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: "9999px",
              border: "none",
              background: "#313628",
              color: "white",
              fontWeight: 500,
              fontSize: "14px",
              cursor: redirecting ? "default" : "pointer",
              opacity: redirecting ? 0.5 : 1,
            }}
          >
            {redirecting ? "Opening…" : "Manage billing"}
          </button>
          {error && <p style={{ margin: 0, fontSize: "13px", color: "#ef4444" }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <a
            href="/pricing"
            style={{
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: "9999px",
              background: "#a20021",
              color: "white",
              fontWeight: 500,
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Upgrade to Pro
          </a>
        </div>
      )}
    </div>
  );
}
