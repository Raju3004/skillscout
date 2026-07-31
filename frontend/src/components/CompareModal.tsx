import { Fragment } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CandidateItem } from "./CandidateRankCard";
import { ScoreRing } from "./ScoreRing";

function bestIndex(values: (number | null)[]): number | null {
  let best = -Infinity;
  let idx: number | null = null;
  values.forEach((v, i) => {
    if (v !== null && v > best) {
      best = v;
      idx = i;
    }
  });
  return idx;
}

export function CompareModal({
  items,
  onClose,
  onRemove,
}: {
  items: CandidateItem[];
  onClose: () => void;
  onRemove: (id: number) => void;
}) {
  const open = items.length >= 2;

  const rows: { label: string; get: (c: CandidateItem) => number | null }[] = [
    { label: "Resume Match", get: (c) => c.match?.resume_match_score ?? null },
    { label: "Code-Verified", get: (c) => c.match?.code_verified_score ?? null },
    { label: "Quality Score", get: (c) => c.match?.quality_score ?? null },
    {
      label: "Accept Odds",
      get: (c) =>
        c.match?.offer_acceptance_probability != null ? c.match.offer_acceptance_probability * 100 : null,
    },
    { label: "Overall Rank", get: (c) => c.match?.overall_rank_score ?? null },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-verified-400">
                  Side-by-side comparison
                </p>
                <h3 className="mt-1 text-lg font-semibold text-mist-100">
                  Comparing {items.length} candidates
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-mist-400 hover:text-mist-100"
              >
                Close
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `140px repeat(${items.length}, minmax(180px, 1fr))` }}
              >
                <div />
                {items.map((item) => (
                  <div key={item.candidate_id} className="text-center">
                    <button
                      onClick={() => onRemove(item.candidate_id)}
                      className="mb-2 text-[10px] text-mist-500 hover:text-mist-300"
                    >
                      Remove ✕
                    </button>
                    {item.github?.avatar_url ? (
                      <img
                        src={item.github.avatar_url}
                        alt=""
                        className="mx-auto h-14 w-14 rounded-full ring-1 ring-ink-700"
                      />
                    ) : (
                      <div className="mx-auto h-14 w-14 rounded-full bg-ink-800" />
                    )}
                    <p className="mt-2 truncate text-sm font-medium text-mist-100">{item.name}</p>
                    {item.github?.profile_url && (
                      <a
                        href={item.github.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-verified-400 hover:text-verified-300"
                      >
                        GitHub ↗
                      </a>
                    )}
                  </div>
                ))}

                {rows.map((row) => {
                  const values = items.map(row.get);
                  const winner = bestIndex(values);
                  return (
                    <Fragment key={row.label}>
                      <div className="flex items-center text-xs font-medium text-mist-400">
                        {row.label}
                      </div>
                      {items.map((item, i) => (
                        <div
                          key={`${row.label}-${item.candidate_id}`}
                          className="flex flex-col items-center gap-2 rounded-lg py-2"
                        >
                          <ScoreRing score={values[i]} size={44} />
                          {winner === i && values[i] !== null && (
                            <span className="rounded-full bg-verified-500/15 px-2 py-0.5 text-[10px] font-medium text-verified-400">
                              Leads
                            </span>
                          )}
                        </div>
                      ))}
                    </Fragment>
                  );
                })}

                <div className="flex items-center text-xs font-medium text-mist-400">Top repos</div>
                {items.map((item) => (
                  <div key={`repos-${item.candidate_id}`} className="text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                      {(item.github?.top_repos ?? []).slice(0, 3).map((r) => (
                        <span
                          key={r.name}
                          className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 text-[10px] text-mist-300"
                        >
                          {r.name}
                        </span>
                      ))}
                      {(!item.github || item.github.top_repos.length === 0) && (
                        <span className="text-[11px] text-mist-500">—</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-start text-xs font-medium text-mist-400">Summary</div>
                {items.map((item) => (
                  <p
                    key={`summary-${item.candidate_id}`}
                    className="text-[11px] leading-relaxed text-mist-400"
                  >
                    {item.match?.explanation?.summary ?? "—"}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
