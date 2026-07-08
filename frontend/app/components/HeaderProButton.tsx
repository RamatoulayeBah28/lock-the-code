"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";

const GRADIENT =
  "linear-gradient(90deg, #fcb97d 0%, #ffd580 20%, #fff1c1 50%, #ffd580 80%, #fcb97d 100%)";

const shimmerStyle: React.CSSProperties = {
  color: "#313628",
  textDecoration: "none",
  background: GRADIENT,
  backgroundSize: "300% auto",
  animation: "shimmer 3s linear infinite",
};

// Same gradient, no animation. transition on background-position lets the browser
// smoothly glide from wherever the shimmer paused to the resting position.
const staticStyle: React.CSSProperties = {
  color: "#313628",
  textDecoration: "none",
  background: GRADIENT,
  backgroundSize: "300% auto",
  backgroundPosition: "0% center",
  transition: "background-position 1s ease-out",
};

export default function HeaderProButton() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    function stop() {
      setAnimating(false);
      document.removeEventListener("click", stop);
    }
    document.addEventListener("click", stop);
    return () => document.removeEventListener("click", stop);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    async function check() {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIsPro(data.is_pro);
        }
      } catch {}
    }
    check();
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn || isPro === null) return null;

  if (isPro) {
    return (
      <div
        className="rounded-full h-9 px-4 flex items-center gap-1.5 font-semibold text-sm border"
        style={{
          borderColor: "#313628",
          color: "var(--foreground)",
          background: "var(--accent)",
        }}
      >
        <span>✦</span>
        <span>Pro</span>
      </div>
    );
  }

  return (
    <Link
      href="/pricing"
      className="border rounded-full h-9 px-4 flex items-center gap-1.5 font-semibold text-sm transition-opacity hover:opacity-80"
      style={animating ? shimmerStyle : staticStyle}
    >
      <span>✦</span>
      <span>Get Pro</span>
    </Link>
  );
}
