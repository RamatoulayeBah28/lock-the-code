"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons";

export default function FlashcardsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <FontAwesomeIcon icon={faLayerGroup} style={{ width: "1.25rem", height: "1.25rem", color: "var(--accent)" }} />
        <h1 className="text-2xl font-semibold">Flashcards</h1>
      </div>
      <p className="text-foreground/60">Coming soon — lock in the patterns with spaced-repetition flashcards.</p>
    </div>
  );
}
