import { motion } from "framer-motion";

interface DiversityStats {
  total_candidates: number;
  source_breakdown: Record<string, number>;
  limited_data_count: number;
  limited_data_pct: number;
  quality_band_distribution: Record<string, number>;
  top_languages: { language: string; count: number }[];
  disclaimer: string;
}

const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub only",
  resume: "Resume only",
  both: "Resume + GitHub",
};

const BAND_LABELS: Record<string, string> = {
  high: "High quality (70+)",
  medium: "Medium (40-69)",
  low: "Low (<40)",
  unscored: "Unscored",
};

const BAND_COLORS: Record<string, string> = {
  high: "bg-verified-500",
  medium: "bg-amber-500",
  low: "bg-mist-400",
  unscored: "bg-ink-700",
};

function Bar({ segments, total }: { segments: { key: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
      {segments.map((s, i) =>
        s.value > 0 ? (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${(s.value / total) * 100}%` }}
            transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={s.color}
          />
        ) : null
      )}
    </div>
  );
}

export function DiversityCard({ stats }: { stats: DiversityStats }) {
  if (stats.total_candidates === 0) return null;

  const sourceSegments = Object.entries(stats.source_breakdown)
    .filter(([, v]) => v > 0)
    .map(([key, value], i) => ({
      key,
      value,
      color: [ "bg-verified-500", "bg-signal-500", "bg-amber-500" ][i % 3],
    }));

  const bandSegments = (["high", "medium", "low", "unscored"] as const)
    .map((key) => ({ key, value: stats.quality_band_distribution[key] ?? 0, color: BAND_COLORS[key] }))
    .filter((s) => s.value > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-mist-400">
          Shortlist composition
        </p>
        {stats.limited_data_count > 0 && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
            {stats.limited_data_count} limited-data candidate{stats.limited_data_count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-mist-300">Evidence source</p>
          <Bar segments={sourceSegments} total={stats.total_candidates} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {sourceSegments.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-mist-400">
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                {SOURCE_LABELS[s.key] ?? s.key} ({s.value})
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-mist-300">Quality score spread</p>
          <Bar segments={bandSegments} total={stats.total_candidates} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {bandSegments.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-mist-400">
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                {BAND_LABELS[s.key] ?? s.key} ({s.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {stats.top_languages.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-mist-300">Language spread</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.top_languages.map((l) => (
              <span
                key={l.language}
                className="rounded-full border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] text-mist-300"
              >
                {l.language} · {l.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-ink-700 pt-3 text-[11px] leading-relaxed text-mist-500">
        {stats.disclaimer}
      </p>
    </motion.div>
  );
}
