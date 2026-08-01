import { AnimatePresence, motion } from "framer-motion";
import type { CandidateItem, QualityFeature } from "./CandidateRankCard";

const QUALITY_LABELS: Record<string, string> = {
  repo_activity: "Repo activity",
  popularity: "Popularity",
  recency: "Recency",
  language_diversity: "Language diversity",
  community: "Community",
  account_maturity: "Account maturity",
  experience: "Experience",
  certifications: "Certifications",
  education: "Education",
};

const ACCEPTANCE_LABELS: Record<string, string> = {
  role_fit: "Role fit",
  growth_signal: "Growth signal",
  reachability: "Reachability",
  profile_stability: "Profile stability",
};

function FeatureBar({
  label,
  feature,
  index,
}: {
  label: string;
  feature: QualityFeature;
  index: number;
}) {
  const pct = Math.round(feature.value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-mist-200">{label}</span>
        <span className="font-mono text-mist-400">+{feature.contribution.toFixed(1)}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: 0.1 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-signal-500 to-verified-500"
        />
      </div>
      <p className="mt-1 text-[11px] text-mist-400">{feature.description}</p>
    </div>
  );
}

export function ExplainModal({
  item,
  onClose,
}: {
  item: CandidateItem | null;
  onClose: () => void;
}) {
  const match = item?.match;
  const explanation = match?.explanation;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {item.github?.avatar_url && (
                  <img src={item.github.avatar_url} alt="" className="h-12 w-12 rounded-full" />
                )}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-verified-400">
                    Explainability
                  </p>
                  <h3 className="text-lg font-semibold text-mist-100">{item.name}</h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-mist-400 hover:text-mist-100"
              >
                Close
              </button>
            </div>

            {explanation?.summary && (
              <p className="mt-5 rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-sm leading-relaxed text-mist-200">
                {explanation.summary}
              </p>
            )}

            {explanation?.notes && explanation.notes.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                {explanation.notes[0]}
              </div>
            )}

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-mist-400">
                  Quality Score breakdown
                </p>
                <div className="space-y-3">
                  {Object.entries(explanation?.quality_breakdown ?? {}).map(([key, feature], i) => (
                    <FeatureBar key={key} label={QUALITY_LABELS[key] ?? key} feature={feature} index={i} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-mist-400">
                  Offer-acceptance breakdown
                </p>
                <div className="space-y-3">
                  {Object.entries(explanation?.acceptance_breakdown ?? {}).map(([key, feature], i) => (
                    <FeatureBar
                      key={key}
                      label={ACCEPTANCE_LABELS[key] ?? key}
                      feature={feature}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            </div>

            {item.github?.top_repos && item.github.top_repos.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-mist-400">
                  Repos considered for JD match
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.github.top_repos.slice(0, 6).map((repo) => (
                    <span
                      key={repo.name}
                      className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-xs text-mist-300"
                      title={repo.description}
                    >
                      {repo.name}
                      {repo.language && <span className="text-mist-500"> · {repo.language}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-[11px] text-mist-500">
              Matching method: {explanation?.semantic_method === "embedding" ? "sentence embeddings" : "TF-IDF fallback"}.
              Every score above is computed live from this candidate's real, public GitHub data.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
