import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

interface Job {
  id: number;
  title: string;
  raw_text: string;
  created_at: string;
}

interface GithubProfile {
  username: string;
  profile_url: string;
  avatar_url: string;
  bio: string;
  public_repos: number;
  followers: number;
  languages: Record<string, number>;
  data_limited: boolean;
}

interface CandidateItem {
  candidate_id: number;
  name: string;
  github: GithubProfile | null;
}

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState<"username" | "org" | "search">("username");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadJob = async () => {
    const res = await api.get(`/jobs/${id}`);
    setJob(res.data);
  };

  const loadCandidates = async () => {
    const res = await api.get(`/jobs/${id}/candidates`);
    setCandidates(res.data);
  };

  useEffect(() => {
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

  if (!job) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/dashboard" className="text-xs text-mist-400 hover:text-mist-200">
        ← All roles
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-mist-100">{job.title}</h1>
      <p className="mt-2 line-clamp-3 max-w-2xl text-sm text-mist-400">{job.raw_text}</p>

      <form onSubmit={onDiscover} className="glass mt-8 flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="flex-1 min-w-[200px]">
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
          {busy ? "Scanning…" : "Discover candidates"}
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-mist-400">{message}</p>}

      <div className="mt-8 space-y-3">
        {candidates.length === 0 && (
          <p className="text-sm text-mist-400">No candidates discovered yet for this role.</p>
        )}
        {candidates.map((c) => (
          <div key={c.candidate_id} className="glass flex items-center gap-4 rounded-xl p-4">
            {c.github?.avatar_url && (
              <img src={c.github.avatar_url} alt="" className="h-12 w-12 rounded-full" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-mist-100">{c.name}</span>
                {c.github?.data_limited && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-500">
                    limited data
                  </span>
                )}
              </div>
              {c.github && (
                <p className="mt-1 text-xs text-mist-400">
                  {c.github.public_repos} public repos · {c.github.followers} followers ·{" "}
                  {Object.keys(c.github.languages).slice(0, 4).join(", ") || "no primary language"}
                </p>
              )}
            </div>
            {c.github?.profile_url && (
              <a
                href={c.github.profile_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-verified-400 hover:text-verified-300"
              >
                View GitHub
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
