import { useAuth } from "../context/AuthContext";
import { Logo } from "../components/Logo";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-ink-950 text-mist-100">
      <header className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-sm text-mist-300">{user?.full_name || user?.email}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-mist-300 transition hover:border-ink-600 hover:text-mist-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-verified-400">Step 1 complete</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Auth &amp; database are live.</h1>
        <p className="mt-3 text-mist-400">
          Job descriptions, GitHub discovery, and the ranked dashboard land next.
        </p>
      </main>
    </div>
  );
}
