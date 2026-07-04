"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";

// Initialise once on mount
function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false, // manual — we track route changes below
      capture_pageleave: true,
    });
  }, []);

  return null;
}

// Track page views on every route change
function PostHogPageView() {
  const pathname = usePathname();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      ph.capture("$pageview", { $current_url: window.location.href });
    }
  }, [pathname, ph]);

  return null;
}

// Identify the signed-in Clerk user so events are tied to a real person
function PostHogIdentify() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const ph = usePostHog();

  useEffect(() => {
    if (isSignedIn && user && ph) {
      ph.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
      });
    } else if (!isSignedIn && ph) {
      ph.reset();
    }
  }, [isSignedIn, user, ph]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      <PostHogPageView />
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
