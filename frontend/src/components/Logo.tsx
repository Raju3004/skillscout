export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-verified-500/15 ring-1 ring-verified-500/40">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 18L3 12L9 6M15 6L21 12L15 18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-verified-400"
          />
        </svg>
      </div>
      <span className="font-mono text-[15px] font-semibold tracking-tight text-mist-100">
        Skill<span className="text-verified-400">Scout</span>
      </span>
    </div>
  );
}
