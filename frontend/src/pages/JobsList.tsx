import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface Job {
  id: number;
  title: string;
  raw_text: string;
  created_at: string;
}

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/jobs")
      .then((res) => setJobs(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-verified-400">Roles</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-mist-100">
            Open job descriptions
          </h1>
        </div>
        <Link
          to="/dashboard/jobs/new"
          className="rounded-lg bg-verified-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-verified-400"
        >
          + New role
        </Link>
      </div>

      {loading && <p className="mt-8 text-sm text-mist-400">Loading…</p>}

      {!loading && jobs.length === 0 && (
        <div className="glass mt-8 rounded-xl p-10 text-center">
          <p className="text-mist-300">No roles yet.</p>
          <p className="mt-1 text-sm text-mist-400">
            Create one to start discovering candidates from real GitHub activity.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/dashboard/jobs/${job.id}`}
            className="glass block rounded-xl p-4 transition hover:border-verified-500/30"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-mist-100">{job.title}</span>
              <span className="text-xs text-mist-400">
                {new Date(job.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-mist-400">{job.raw_text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
