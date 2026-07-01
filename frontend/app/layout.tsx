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
        <ClerkProvider>
          <header className="flex justify-end items-center p-4 gap-4 h-16">
            <Show when="signed-out">
              <SignInButton forceRedirectUrl="/dashboard" />
              <SignUpButton forceRedirectUrl="/dashboard">
                <button className="bg-primary text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
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
              <Link
                href="/review"
                className="text-sm font-medium hover:underline"
              >
                Review
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium hover:underline"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
