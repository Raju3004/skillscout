import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { CandidateRankCard, type CandidateItem } from "../components/CandidateRankCard";
import { StatTile } from "../components/StatTile";
import { ExplainModal } from "../components/ExplainModal";

interface Job {
  id: number;
  title: string;
  raw_text: string;
  created_at: string;
}

type SortKey = "overall_rank_score" | "code_verified_score" | "quality_score";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "overall_rank_score", label: "Overall" },
  { key: "code_verified_score", label: "JD Match" },
  { key: "quality_score", label: "Quality" },
];

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState<"username" | "org" | "search">("username");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall_rank_score");
  const [loaded, setLoaded] = useState(false);
  const [explainTarget, setExplainTarget] = useState<CandidateItem | null>(null);

  const loadJob = async () => {
    const res = await api.get(`/jobs/${id}`);
    setJob(res.data);
  };

  const loadCandidates = async () => {
    const res = await api.get(`/jobs/${id}/candidates`);
    setCandidates(res.data);
    setLoaded(true);
  };

  useEffect(() => {
    setLoaded(false);
    loadJob();
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onDiscover = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await api.post(`/jobs/${id}/discover`, {
        query: query.trim(),
        query_type: queryType,
        limit: 8,
      });
      if (res.data.rate_limited) {
        setMessage("GitHub rate limit hit — showing what was fetched before the limit.");
      } else if (res.data.errors?.length) {
        setMessage(
          `Discovered ${res.data.discovered}. Skipped: ${res.data.errors
            .map((e: any) => e.identifier)
            .join(", ")}`
        );
      } else {
        setMessage(`Discovered ${res.data.discovered}, updated ${res.data.updated}.`);
      }
      await loadCandidates();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || "Discovery failed.");
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const av = a.match?.[sortKey] ?? 0;
      const bv = b.match?.[sortKey] ?? 0;
      return (bv ?? 0) - (av ?? 0);
    });
  }, [candidates, sortKey]);

  const stats = useMemo(() => {
    const scores = candidates.map((c) => c.match?.overall_rank_score ?? 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const top = scores.length ? Math.max(...scores) : 0;
    return { count: candidates.length, avg, top };
  }, [candidates]);

  if (!job) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/dashboard" className="text-xs text-mist-400 hover:text-mist-200">
        ← All roles
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-mist-100">{job.title}</h1>
      <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-mist-400">{job.raw_text}</p>

      <form onSubmit={onDiscover} className="glass mt-8 flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-mist-300">
            GitHub username / org / search query
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 outline-none focus:border-verified-500 focus:ring-2 focus:ring-verified-500/20"
            placeholder="e.g. torvalds"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-mist-300">Type</label>
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value as any)}
            className="rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 outline-none focus:border-verified-500"
          >
            <option value="username">Username</option>
            <option value="org">Org members</option>
            <option value="search">Search query</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-verified-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-verified-400 disabled:opacity-60"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
              Scanning GitHub…
            </span>
          ) : (
            "Discover candidates"
          )}
        </button>
      </form>

      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 text-sm text-mist-400"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      {candidates.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          <StatTile label="Candidates found" value={stats.count} />
          <StatTile label="Avg overall score" value={stats.avg} decimals={1} />
          <StatTile label="Top score" value={stats.top} decimals={1} />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-mist-300">
          Ranked candidates {candidates.length > 0 && `(${candidates.length})`}
        </h2>
        {candidates.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-ink-700 p-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  sortKey === opt.key
                    ? "bg-verified-500 text-ink-950"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                Sort: {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {loaded && candidates.length === 0 && (
          <div className="glass rounded-xl p-10 text-center">
            <p className="text-mist-300">No candidates discovered yet for this role.</p>
            <p className="mt-1 text-sm text-mist-400">
              Enter a GitHub username, org, or search query above to start scanning.
            </p>
          </div>
        )}
        {sorted.map((c, i) => (
          <CandidateRankCard
            key={c.candidate_id}
            item={c}
            rank={i + 1}
            index={i}
            onExplain={setExplainTarget}
          />
        ))}
      </div>

      <ExplainModal item={explainTarget} onClose={() => setExplainTarget(null)} />
    </div>
  );
}
