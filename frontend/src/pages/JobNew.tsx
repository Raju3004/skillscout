import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function JobNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!rawText.trim() && !file) {
      setError("Paste a job description or upload a PDF/DOCX.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", title || "Untitled role");
      if (rawText.trim()) form.append("raw_text", rawText);
      if (file) form.append("file", file);
      const res = await api.post("/jobs", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/dashboard/jobs/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not create job description.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-verified-400">New role</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-mist-100">
        Paste or upload a job description
      </h1>
      <p className="mt-2 text-sm text-mist-400">
        SkillScout will semantically match this against real GitHub activity.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-mist-300">Role title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 outline-none focus:border-verified-500 focus:ring-2 focus:ring-verified-500/20"
            placeholder="Senior Backend Engineer"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-mist-300">
            Job description text
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 outline-none focus:border-verified-500 focus:ring-2 focus:ring-verified-500/20"
            placeholder="Paste the full job description here…"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-ink-700" />
          <span className="text-xs text-mist-400">or</span>
          <div className="h-px flex-1 bg-ink-700" />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-mist-300">
            Upload PDF / DOCX
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-mist-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-mist-200 hover:file:bg-ink-700"
          />
        </div>

        {error && (
          <div className="animate-rise rounded-lg border border-[#f0554c]/30 bg-[#f0554c]/10 px-3 py-2 text-sm text-[#f0847d]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-verified-500 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-verified-400 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create role"}
        </button>
      </form>
    </div>
  );
}
