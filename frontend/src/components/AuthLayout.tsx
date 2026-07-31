import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Logo } from "./Logo";

const FEED_LINES = [
  { label: "commits/wk", value: "42", ok: true },
  { label: "languages", value: "Go, Rust, TS", ok: true },
  { label: "match", value: "94%", ok: true },
  { label: "acceptance", value: "0.81", ok: true },
];

export function AuthLayout({ children, tagline }: { children: ReactNode; tagline: string }) {
  return (
    <div className="flex min-h-screen bg-ink-950 text-mist-100">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-ink-700 bg-ink-900 p-12 lg:flex">
        <div className="bg-grid absolute inset-0 opacity-60" />
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-verified-500), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-signal-500), transparent 70%)" }}
        />

        <Logo className="relative z-10" />

        <div className="relative z-10 max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-verified-400">
            {tagline}
          </p>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.15] tracking-tight text-mist-100">
            Hire from the code,
            <br /> not the résumé.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-mist-300">
            SkillScout scores candidates from real GitHub activity and explains
            every ranking — provable, not promised.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="glass relative z-10 w-full max-w-md rounded-xl p-4 font-mono text-[12.5px]"
        >
          <div className="mb-3 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f0554c]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-verified-500/70" />
            <span className="ml-2 text-mist-400">candidate_scan.json</span>
          </div>
          {FEED_LINES.map((line, i) => (
            <motion.div
              key={line.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.12 }}
              className="flex items-center justify-between py-1"
            >
              <span className="text-mist-400">{line.label}</span>
              <span className="text-verified-400">{line.value}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
