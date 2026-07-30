"use client";

import dynamic from "next/dynamic";

// SSR disabled: this page uses sessionStorage, getUserMedia, Web Audio, and
// WebWorkers — none of which exist on the server. Disabling SSR eliminates
// the hydration mismatch and lets useState lazy initializers read
// sessionStorage safely on mount.
const InterviewPage = dynamic(() => import("./InterviewClient"), { ssr: false });

export default function Page() {
  return <InterviewPage />;
}
