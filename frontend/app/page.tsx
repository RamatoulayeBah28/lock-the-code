"use client";

import { useAuth, SignUpButton } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const INTEGRATION_LOGOS = ["NeetCode", "LeetCode", "HackerRank", "CodeSignal"];

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/review");
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="flex flex-col flex-1 items-center font-sans">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-start gap-10 pt-4 pb-6 px-6 text-center">
        <div className="flex flex-col items-center ">
          <Image
            src="/lock-the-code-logo.png"
            alt="Lock The Code"
            width={400}
            height={260}
            className="object-contain"
          />
          <h1 className="max-w-xl text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-foreground">
            The Only Free Technical Interview Study Plan You Need
          </h1>
        </div>

        <p className="max-w-md text-lg leading-7 text-foreground/70">
          Track every problem you solve, review it before you forget it, and
          walk into your next interview ready.
        </p>
        <div className="flex items-center gap-3">
          <SignUpButton forceRedirectUrl="/review">
            <button className="rounded-full bg-primary text-primary-foreground font-medium text-base h-12 px-8 cursor-pointer transition-opacity hover:opacity-90">
              Start Free
            </button>
          </SignUpButton>
          <a
            href="/pricing"
            className="rounded-full border border-foreground/20 text-foreground font-medium text-base h-12 px-8 flex items-center transition-opacity hover:opacity-70"
          >
            Get Pro
          </a>
        </div>
      </main>
    </div>
  );
}
