"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function UnsubscribeContent() {
  const params = useSearchParams();
  const uid = params.get("uid");
  const t = params.get("t");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    uid && t ? "loading" : "error"
  );

  useEffect(() => {
    if (!uid || !t) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/unsubscribe/${uid}/${t}`)
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [uid, t]);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <Image src="/lock-the-code-fav.png" alt="Lock The Code" width={40} height={40} style={{ marginBottom: 24, opacity: 0.7 }} />

      {status === "loading" && (
        <p style={{ color: "#6b7280" }}>Unsubscribing...</p>
      )}

      {status === "success" && (
        <>
          <h2 style={{ color: "#313628", margin: "0 0 8px 0" }}>You&apos;ve been unsubscribed</h2>
          <p style={{ color: "#6b7280", margin: "0 0 24px 0" }}>You won&apos;t receive daily review reminders anymore.</p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Changed your mind? Go to{" "}
            <Link href="/dashboard" style={{ color: "#56876D" }}>your dashboard</Link>
            {" "}and re-enable emails under your account menu &rarr; Notifications.
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <h2 style={{ color: "#313628", margin: "0 0 8px 0" }}>Invalid link</h2>
          <p style={{ color: "#6b7280", margin: "0 0 24px 0" }}>This unsubscribe link is invalid or has already been used.</p>
          <Link href="/" style={{ color: "#56876D", fontSize: 14 }}>Go home</Link>
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<p style={{ textAlign: "center", marginTop: 80, color: "#6b7280" }}>Loading...</p>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
