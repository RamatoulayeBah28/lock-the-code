"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";

type Props = {
  featureLabel: string;
  onClose: () => void;
};

export default function PaywallModal({ featureLabel, onClose }: Props) {
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-5 text-center"
        style={{ backgroundColor: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(252,185,125,0.15)" }}
        >
          <FontAwesomeIcon
            icon={faLock}
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: "var(--accent)",
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Unlock AI-Powered Practice</h2>
          <p className="text-sm text-foreground/60">
            Start your free 7-day Pro trial to access{" "}
            <span className="font-medium text-foreground">{featureLabel}</span>{" "}
            and everything else Pro has to offer.
          </p>
        </div>

        <button
          onClick={() => router.push("/pricing")}
          className="w-full rounded-full bg-primary text-primary-foreground font-medium text-sm h-11 cursor-pointer transition-opacity hover:opacity-90"
        >
          Start Free Trial
        </button>

        <button
          onClick={onClose}
          aria-label="Close upgrade dialog"
          className="text-sm text-foreground/60 hover:text-foreground/75 transition-colors cursor-pointer"
        >
          I&apos;m not ready to get hired...
        </button>
      </div>
    </div>
  );
}
