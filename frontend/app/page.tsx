import { SignUpButton } from "@clerk/nextjs";

const INTEGRATION_LOGOS = ["NeetCode", "LeetCode", "HackerRank", "CodeSignal"];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center font-sans">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-10 py-24 px-6 text-center">
        <h1 className="max-w-xl text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-foreground">
          The Only Free Technical Interview Study Plan You Need
        </h1>
        <p className="max-w-md text-lg leading-7 text-foreground/70">
          Track every problem you solve, review it before you forget it, and
          walk into your next interview ready.
        </p>
        <div className="flex items-center gap-3">
          <SignUpButton forceRedirectUrl="/dashboard">
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

      <div className="w-full overflow-hidden border-t border-foreground/10 py-6">
        <div className="flex w-max animate-marquee gap-16 text-foreground/40 font-medium text-lg">
          {[...INTEGRATION_LOGOS, ...INTEGRATION_LOGOS].map((name, i) => (
            <span key={`${name}-${i}`} className="whitespace-nowrap">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
