"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

function formatHour(h: number) {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

export default function NotificationsSettings() {
  const { getToken } = useAuth();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifHour, setNotifHour] = useState(17);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/notifications`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setNotifEnabled(data.email_notifications_enabled);
        setNotifHour(data.email_notification_hour);
      }
      setNotifLoaded(true);
    }
    load().catch(() => {});
  }, [getToken]);

  async function handleSave() {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/notifications`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled: notifEnabled, hour: notifHour }),
        },
      );
      setNotifMsg(res.ok ? "Saved." : "Failed to save.");
    } catch {
      setNotifMsg("Failed to save.");
    }
    setNotifSaving(false);
  }

  const hourOptions = Array.from({ length: 17 }, (_, i) => i + 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Notifications</h2>

      {/* Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "20px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontWeight: 500, fontSize: "14px" }}>Daily email reminders</p>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Get an email when problems are due</p>
        </div>
        <button
          onClick={() => setNotifEnabled((v) => !v)}
          disabled={!notifLoaded}
          role="switch"
          aria-checked={notifEnabled}
          style={{
            position: "relative",
            width: "44px",
            height: "24px",
            borderRadius: "9999px",
            border: "none",
            cursor: notifLoaded ? "pointer" : "default",
            background: notifEnabled ? "#a20021" : "#d1d5db",
            opacity: notifLoaded ? 1 : 0.4,
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute",
            top: "2px",
            left: notifEnabled ? "22px" : "2px",
            width: "20px",
            height: "20px",
            borderRadius: "9999px",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }} />
        </button>
      </div>

      {/* Time picker */}
      <div style={{ opacity: notifEnabled ? 1 : 0.4, pointerEvents: notifEnabled ? "auto" : "none", display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontWeight: 500, fontSize: "14px" }}>Send at</label>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>All times are UTC</p>
        <select
          value={notifHour}
          onChange={(e) => setNotifHour(Number(e.target.value))}
          style={{
            width: "160px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            fontSize: "14px",
            marginTop: "4px",
          }}
        >
          {hourOptions.map((h) => (
            <option key={h} value={h}>{formatHour(h)}</option>
          ))}
        </select>
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={handleSave}
          disabled={notifSaving || !notifLoaded}
          style={{
            padding: "8px 20px",
            borderRadius: "9999px",
            border: "none",
            background: "#313628",
            color: "white",
            fontWeight: 500,
            fontSize: "14px",
            cursor: notifSaving || !notifLoaded ? "default" : "pointer",
            opacity: notifSaving || !notifLoaded ? 0.5 : 1,
          }}
        >
          {notifSaving ? "Saving..." : "Save preferences"}
        </button>
        {notifMsg && (
          <span style={{ fontSize: "13px", color: "#6b7280" }}>{notifMsg}</span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
        Turning off daily reminders unsubscribes you from all review emails.
        Every email also includes a one-click unsubscribe link.
      </p>
    </div>
  );
}
