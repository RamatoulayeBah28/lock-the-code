import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import PostHogProvider from "@/app/components/PostHogProvider";
import NotificationsSettings from "@/app/components/NotificationsSettings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lock The Code",
  description: "The only free technical interview study plan you need.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-foreground">
        <ClerkProvider afterSignOutUrl="/">

          <PostHogProvider>
          <header className="flex justify-between items-center px-6 h-16 border-b border-foreground/10 shrink-0">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              Lock The Code
            </Link>
            <div className="flex items-center gap-4">
              <Show when="signed-out">
                <SignInButton forceRedirectUrl="/review" />
                <SignUpButton forceRedirectUrl="/review">
                  <button className="bg-primary text-white rounded-full font-medium text-sm h-10 px-5 cursor-pointer">
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/pricing"
                  className="border rounded-full bg-accent text-foreground font-semibold text-sm h-9 px-4 flex items-center gap-1.5 transition-opacity hover:opacity-80"
                >
                  <span className="text-xs"></span> Pro
                </Link>
                <UserButton>
                  <UserButton.UserProfilePage
                    label="Notifications"
                    url="notifications"
                    labelIcon={
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                      </svg>
                    }
                  >
                    <NotificationsSettings />
                  </UserButton.UserProfilePage>
                </UserButton>
              </Show>
            </div>
          </header>
          {children}
          </PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
