"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

type Tab = "profile" | "security" | "notifications" | "account";

function formatHour(h: number) {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  // Profile
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifHour, setNotifHour] = useState(8);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  // Account
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNotifs() {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/notifications`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data = await res.json();
      setNotifEnabled(data.email_notifications_enabled);
      setNotifHour(data.email_notification_hour);
      setNotifLoaded(true);
    }
    loadNotifs().catch(() => {});
  }, [getToken]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      await user.setProfileImage({ file });
    } catch (err) {
      console.error(err);
    }
    setAvatarUploading(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true });
      setPasswordMsg({ ok: true, text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    }
    setPasswordLoading(false);
  }

  async function handleNotifSave() {
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

  async function handleDeleteAccount() {
    if (!user || deleteInput !== "DELETE") return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await user.delete();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleteLoading(false);
    }
  }

  if (!isLoaded || !user) return <p className="p-8">Loading...</p>;

  const hourOptions = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM UTC

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "notifications", label: "Notifications" },
    { id: "account", label: "Account" },
  ];

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="flex border-b border-foreground/10 mb-8 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile ── */}
      {tab === "profile" && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Image
                src={user.imageUrl}
                alt="Profile photo"
                width={72}
                height={72}
                className="rounded-full object-cover"
              />
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <span className="text-white text-xs font-medium">...</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-base">
                {user.fullName ?? user.username ?? "—"}
              </p>
              <p className="text-sm text-foreground/50">
                {user.primaryEmailAddress?.emailAddress}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="mt-1.5 text-sm text-primary hover:underline disabled:opacity-50 text-left cursor-pointer"
              >
                {avatarUploading ? "Uploading..." : "Change photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          <div className="rounded-xl border border-foreground/10 p-4 text-sm text-foreground/50">
            To update your name or email address, click the account icon in the
            top-right corner of the app.
          </div>
        </section>
      )}

      {/* ── Security ── */}
      {tab === "security" && (
        <section className="flex flex-col gap-6">
          <h2 className="font-medium">Change password</h2>
          <form
            onSubmit={handlePasswordChange}
            className="flex flex-col gap-4 max-w-sm"
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.ok ? "text-success" : "text-primary"}`}>
                {passwordMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordLoading}
              className="rounded-full bg-foreground text-surface font-medium text-sm h-10 px-6 self-start cursor-pointer hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {passwordLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </section>
      )}

      {/* ── Notifications ── */}
      {tab === "notifications" && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between py-4 border-b border-foreground/10">
            <div>
              <p className="font-medium">Daily email reminders</p>
              <p className="text-sm text-foreground/50">
                Get an email when problems are due for review
              </p>
            </div>
            <button
              onClick={() => setNotifEnabled((v) => !v)}
              disabled={!notifLoaded}
              role="switch"
              aria-checked={notifEnabled}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 cursor-pointer ${
                notifEnabled ? "bg-primary" : "bg-foreground/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  notifEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div
            className={`flex flex-col gap-2 transition-opacity ${
              notifEnabled ? "opacity-100" : "opacity-40 pointer-events-none"
            }`}
          >
            <label className="font-medium text-sm">Send at</label>
            <p className="text-sm text-foreground/50">All times are UTC</p>
            <select
              value={notifHour}
              onChange={(e) => setNotifHour(Number(e.target.value))}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-44"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleNotifSave}
              disabled={notifSaving || !notifLoaded}
              className="rounded-full bg-foreground text-surface font-medium text-sm h-10 px-6 cursor-pointer hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {notifSaving ? "Saving..." : "Save preferences"}
            </button>
            {notifMsg && (
              <p className="text-sm text-foreground/60">{notifMsg}</p>
            )}
          </div>

          <p className="text-xs text-foreground/40 mt-2">
            Turning off daily reminders unsubscribes you from all review emails.
            Every email also includes a one-click unsubscribe link.
          </p>
        </section>
      )}

      {/* ── Account ── */}
      {tab === "account" && (
        <section className="flex flex-col gap-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <h2 className="font-medium text-primary mb-1">Delete account</h2>
            <p className="text-sm text-foreground/60 mb-4">
              Permanently deletes your account and all your problems. There is
              no going back.
            </p>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="rounded-full border border-primary text-primary font-medium text-sm h-9 px-5 cursor-pointer hover:bg-primary hover:text-white transition-colors"
              >
                Delete my account
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  Type{" "}
                  <span className="font-mono font-semibold">DELETE</span> to
                  confirm
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="rounded-lg border border-primary/30 px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {deleteError && (
                  <p className="text-sm text-primary">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== "DELETE" || deleteLoading}
                    className="rounded-full bg-primary text-white font-medium text-sm h-9 px-5 cursor-pointer hover:opacity-80 disabled:opacity-40 transition-opacity"
                  >
                    {deleteLoading ? "Deleting..." : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirm(false);
                      setDeleteInput("");
                    }}
                    className="rounded-full border border-foreground/20 text-foreground/60 font-medium text-sm h-9 px-5 cursor-pointer hover:opacity-70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
