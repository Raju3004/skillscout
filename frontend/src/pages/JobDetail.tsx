import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { CandidateRankCard, type CandidateItem } from "../components/CandidateRankCard";
import { StatTile } from "../components/StatTile";
import { ExplainModal } from "../components/ExplainModal";
import { CompareModal } from "../components/CompareModal";
import { DiversityCard } from "../components/DiversityCard";

const MAX_COMPARE = 4;

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
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [diversityStats, setDiversityStats] = useState<any>(null);
  const [shortlistBusyId, setShortlistBusyId] = useState<number | null>(null);

  const loadJob = async () => {
    const res = await api.get(`/jobs/${id}`);
    setJob(res.data);
  };

  const loadCandidates = async () => {
    const res = await api.get(`/jobs/${id}/candidates`);
    setCandidates(res.data);
    setLoaded(true);
  };

  const loadDiversity = async () => {
    const res = await api.get(`/jobs/${id}/diversity`);
    setDiversityStats(res.data);
  };

  useEffect(() => {
    setLoaded(false);
    loadJob();
    loadCandidates();
    loadDiversity();
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
      await loadDiversity();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || "Discovery failed.");
    } finally {
      setBusy(false);
    }
  };

  const onUploadResumes = async (e: FormEvent) => {
    e.preventDefault();
    if (resumeFiles.length === 0) return;
    setResumeBusy(true);
    setResumeMessage("");
    try {
      const form = new FormData();
      resumeFiles.forEach((f) => form.append("files", f));
      const res = await api.post(`/jobs/${id}/resumes`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const results = res.data.results as {
        filename: string;
        candidate_name: string | null;
        linked_to_github: boolean;
        error: string | null;
      }[];
      const ok = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);
      const linked = ok.filter((r) => r.linked_to_github).length;
      let msg = `Parsed ${ok.length} resume${ok.length === 1 ? "" : "s"}`;
      if (linked > 0) msg += `, ${linked} linked to an existing GitHub match`;
      if (failed.length > 0) {
        msg += `. Skipped: ${failed.map((r) => `${r.filename} (${r.error})`).join(", ")}`;
      }
      setResumeMessage(msg);
      setResumeFiles([]);
      await loadCandidates();
      await loadDiversity();
    } catch (err: any) {
      setResumeMessage(err?.response?.data?.detail || "Resume upload failed.");
    } finally {
      setResumeBusy(false);
    }
  };

  const toggleShortlist = async (item: CandidateItem) => {
    setShortlistBusyId(item.candidate_id);
    const nextState = !item.is_shortlisted;
    setCandidates((prev) =>
      prev.map((c) => (c.candidate_id === item.candidate_id ? { ...c, is_shortlisted: nextState } : c))
    );
    try {
      if (nextState) {
        await api.post(`/jobs/${id}/shortlist/${item.candidate_id}`);
      } else {
        await api.delete(`/jobs/${id}/shortlist/${item.candidate_id}`);
      }
    } catch {
      setCandidates((prev) =>
        prev.map((c) => (c.candidate_id === item.candidate_id ? { ...c, is_shortlisted: !nextState } : c))
      );
      setMessage("Could not update shortlist. Try again.");
    } finally {
      setShortlistBusyId(null);
    }
  };

  const toggleSelect = (candidateId: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(candidateId)) return prev.filter((id) => id !== candidateId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, candidateId];
    });
  };

  const selectedItems = useMemo(
    () => selectedIds.map((sid) => candidates.find((c) => c.candidate_id === sid)).filter(Boolean) as CandidateItem[],
    [selectedIds, candidates]
  );

  const [bulkBusy, setBulkBusy] = useState<"pass" | "delete" | null>(null);

  const onMarkPassedSelected = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy("pass");
    try {
      await Promise.all(
        selectedIds.map((cid) =>
          api.patch(`/jobs/${id}/candidates/${cid}/status`, { status: "passed" })
        )
      );
      setCandidates((prev) =>
        prev.map((c) =>
          selectedIds.includes(c.candidate_id) && c.match
            ? { ...c, match: { ...c.match, status: "passed" } }
            : c
        )
      );
      setSelectedIds([]);
    } catch {
      setMessage("Could not update status for some candidates.");
    } finally {
      setBulkBusy(null);
    }
  };

  const onDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const names = selectedItems.map((c) => c.name).join(", ");
    if (!window.confirm(`Remove ${selectedIds.length} candidate(s) from this role? (${names})`)) return;
    setBulkBusy("delete");
    try {
      await Promise.all(selectedIds.map((cid) => api.delete(`/jobs/${id}/candidates/${cid}`)));
      setCandidates((prev) => prev.filter((c) => !selectedIds.includes(c.candidate_id)));
      setSelectedIds([]);
      await loadDiversity();
    } catch {
      setMessage("Could not delete some candidates.");
    } finally {
      setBulkBusy(null);
    }
  };

  const [exporting, setExporting] = useState<string | null>(null);

  const onExport = async (format: "csv" | "pdf", shortlistOnly = false) => {
    const key = shortlistOnly ? `${format}-shortlist` : format;
    setExporting(key);
    try {
      const res = await api.get(`/jobs/${id}/export/${format}`, {
        responseType: "blob",
        params: shortlistOnly ? { shortlist_only: true } : undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      const suffix = shortlistOnly ? "-shortlist" : "";
      a.download = `skillscout-${job?.title.replace(/\s+/g, "_").toLowerCase() ?? "shortlist"}${suffix}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage("Export failed.");
    } finally {
      setExporting(null);
    }
  };

  const shortlistCount = useMemo(() => candidates.filter((c) => c.is_shortlisted).length, [candidates]);

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

      <form onSubmit={onUploadResumes} className="glass mt-4 flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-mist-300">
            Upload resumes (PDF / DOCX) for this role
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={(e) => setResumeFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-mist-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-mist-200 hover:file:bg-ink-700"
          />
        </div>
        <button
          type="submit"
          disabled={resumeBusy || resumeFiles.length === 0}
          className="rounded-lg border border-signal-500/40 bg-signal-500/15 px-5 py-2.5 text-sm font-semibold text-signal-400 transition hover:bg-signal-500/25 disabled:opacity-50"
        >
          {resumeBusy ? "Parsing…" : `Upload ${resumeFiles.length || ""} resume${resumeFiles.length === 1 ? "" : "s"}`.trim()}
        </button>
      </form>

      <AnimatePresence>
        {resumeMessage && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 text-sm text-mist-400"
          >
            {resumeMessage}
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

      {diversityStats && (
        <div className="mt-4">
          <DiversityCard stats={diversityStats} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-mist-300">
          Ranked candidates {candidates.length > 0 && `(${candidates.length})`}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {shortlistCount > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-1">
              <span className="px-2 text-xs font-medium text-amber-400">★ Shortlist ({shortlistCount})</span>
              <button
                onClick={() => onExport("csv", true)}
                disabled={exporting !== null}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:text-amber-100 disabled:opacity-50"
              >
                {exporting === "csv-shortlist" ? "Exporting…" : "CSV"}
              </button>
              <button
                onClick={() => onExport("pdf", true)}
                disabled={exporting !== null}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:text-amber-100 disabled:opacity-50"
              >
                {exporting === "pdf-shortlist" ? "Exporting…" : "PDF"}
              </button>
            </div>
          )}
          {candidates.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-ink-700 p-1">
              <button
                onClick={() => onExport("csv")}
                disabled={exporting !== null}
                className="rounded-md px-3 py-1 text-xs font-medium text-mist-400 transition hover:text-mist-100 disabled:opacity-50"
              >
                {exporting === "csv" ? "Exporting…" : "Export CSV"}
              </button>
              <button
                onClick={() => onExport("pdf")}
                disabled={exporting !== null}
                className="rounded-md px-3 py-1 text-xs font-medium text-mist-400 transition hover:text-mist-100 disabled:opacity-50"
              >
                {exporting === "pdf" ? "Exporting…" : "Export PDF"}
              </button>
            </div>
          )}
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
            selected={selectedIds.includes(c.candidate_id)}
            onToggleSelect={toggleSelect}
            selectionDisabled={selectedIds.length >= MAX_COMPARE}
            onToggleShortlist={toggleShortlist}
            shortlistBusy={shortlistBusyId === c.candidate_id}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedIds.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
          >
            <div className="glass flex items-center gap-2 rounded-full px-3 py-2 shadow-xl">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-verified-500 text-xs font-bold text-ink-950">
                {selectedIds.length}
              </span>
              <span className="pr-1 text-xs text-mist-400">selected</span>
              <div className="h-4 w-px bg-ink-700" />
              {selectedIds.length >= 2 && (
                <button
                  onClick={() => setCompareOpen(true)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-mist-100 transition hover:text-verified-400"
                >
                  Compare
                </button>
              )}
              <button
                onClick={onMarkPassedSelected}
                disabled={bulkBusy !== null}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-mist-100 transition hover:text-verified-400 disabled:opacity-50"
              >
                {bulkBusy === "pass" ? "Marking…" : "✓ Mark Passed"}
              </button>
              <button
                onClick={onDeleteSelected}
                disabled={bulkBusy !== null}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#f0847d] transition hover:text-[#f0a49d] disabled:opacity-50"
              >
                {bulkBusy === "delete" ? "Removing…" : "Delete"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExplainModal item={explainTarget} onClose={() => setExplainTarget(null)} />
      {compareOpen && (
        <CompareModal
          items={selectedItems}
          onClose={() => setCompareOpen(false)}
          onRemove={(cid) => setSelectedIds((prev) => prev.filter((id) => id !== cid))}
        />
      )}
    </div>
  );
}
