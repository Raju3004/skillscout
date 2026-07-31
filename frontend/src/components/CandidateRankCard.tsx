import { motion } from "framer-motion";
import { ScoreRing } from "./ScoreRing";

export interface QualityFeature {
  value: number;
  weight: number;
  contribution: number;
  description: string;
}

export interface MatchExplanation {
  quality_breakdown?: Record<string, QualityFeature>;
  semantic_method?: string;
  notes?: string[];
}

export interface MatchResult {
  source: string;
  resume_match_score: number | null;
  code_verified_score: number | null;
  quality_score: number | null;
  offer_acceptance_probability: number | null;
  overall_rank_score: number;
  explanation: MatchExplanation;
  data_limited: boolean;
}

export interface GithubProfile {
  username: string;
  profile_url: string;
  avatar_url: string;
  bio: string;
  public_repos: number;
  followers: number;
  languages: Record<string, number>;
  top_repos: { name: string; description: string; language: string | null; stars: number }[];
  data_limited: boolean;
}

export interface CandidateItem {
  candidate_id: number;
  name: string;
  github: GithubProfile | null;
  match: MatchResult | null;
}

const FEATURE_LABELS: Record<string, string> = {
  repo_activity: "Repo activity",
  popularity: "Popularity",
  recency: "Recency",
  language_diversity: "Language diversity",
  community: "Community",
  account_maturity: "Account maturity",
};

function topReasons(breakdown?: Record<string, QualityFeature>) {
  if (!breakdown) return [];
  return Object.entries(breakdown)
    .sort((a, b) => b[1].contribution - a[1].contribution)
    .slice(0, 3);
}

export function CandidateRankCard({
  item,
  rank,
  index,
}: {
  item: CandidateItem;
  rank: number;
  index: number;
}) {
  const match = item.match;
  const github = item.github;
  const reasons = topReasons(match?.explanation?.quality_breakdown);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="glass group relative rounded-xl p-4 transition hover:border-verified-500/30"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-800 font-mono text-xs font-semibold text-mist-300">
          {rank}
        </div>

        {github?.avatar_url ? (
          <img src={github.avatar_url} alt="" className="h-11 w-11 rounded-full ring-1 ring-ink-700" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-ink-800" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-mist-100">{item.name}</span>
            {github?.data_limited && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                limited data
              </span>
            )}
            {match?.source === "both" && (
              <span className="shrink-0 rounded-full bg-signal-500/15 px-2 py-0.5 text-[10px] font-medium text-signal-400">
                resume + code
              </span>
            )}
          </div>
          {github && (
            <p className="mt-0.5 truncate text-xs text-mist-400">
              {github.public_repos} repos · {github.followers} followers ·{" "}
              {Object.keys(github.languages || {}).slice(0, 3).join(", ") || "no primary language"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <ScoreRing score={match?.code_verified_score ?? null} label="JD Match" size={56} delay={0.1} />
          <ScoreRing score={match?.quality_score ?? null} label="Quality" size={56} delay={0.2} />
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full font-mono text-lg font-bold ${
                (match?.overall_rank_score ?? 0) >= 70
                  ? "bg-verified-500/15 text-verified-400"
                  : (match?.overall_rank_score ?? 0) >= 40
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-ink-800 text-mist-300"
              }`}
            >
              {Math.round(match?.overall_rank_score ?? 0)}
            </div>
            <span className="text-[10px] uppercase tracking-wide text-mist-400">Overall</span>
          </div>
        </div>

        {github?.profile_url && (
          <a
            href={github.profile_url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-verified-400 hover:text-verified-300"
          >
            GitHub ↗
          </a>
        )}
      </div>

      {reasons.length > 0 && (
        <div className="pointer-events-none absolute left-16 right-4 top-full z-20 mt-2 origin-top scale-95 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100">
          <div className="glass rounded-lg p-3 text-xs shadow-xl">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-verified-400">
              Why this score
            </p>
            <ul className="space-y-1">
              {reasons.map(([key, feature]) => (
                <li key={key} className="flex items-center justify-between gap-3 text-mist-300">
                  <span>{FEATURE_LABELS[key] ?? key}</span>
                  <span className="font-mono text-mist-100">+{feature.contribution.toFixed(1)}</span>
                </li>
              ))}
            </ul>
            {match?.explanation?.notes && match.explanation.notes.length > 0 && (
              <p className="mt-2 border-t border-ink-700 pt-2 text-amber-400/90">
                {match.explanation.notes[0]}
              </p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
