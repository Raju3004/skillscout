import { Outlet } from "react-router-dom";
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
      <main>
        <Outlet />
      </main>
    </div>
  );
}
