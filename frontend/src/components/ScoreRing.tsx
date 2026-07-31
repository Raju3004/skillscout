import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function bandColor(score: number) {
  if (score >= 70) return { stroke: "var(--color-verified-500)", text: "text-verified-400" };
  if (score >= 40) return { stroke: "var(--color-amber-500)", text: "text-amber-500" };
  return { stroke: "var(--color-mist-400)", text: "text-mist-300" };
}

export function ScoreRing({
  score,
  size = 64,
  strokeWidth = 5,
  label,
  delay = 0,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  delay?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const { stroke, text } = bandColor(value);
  const offset = circumference - (mounted ? value / 100 : 0) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-ink-700)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {score === null ? (
            <span className="text-[11px] text-mist-400">N/A</span>
          ) : (
            <span className={`font-mono text-sm font-semibold ${text}`}>{Math.round(value)}</span>
          )}
        </div>
      </div>
      {label && <span className="text-[10px] uppercase tracking-wide text-mist-400">{label}</span>}
    </div>
  );
}
