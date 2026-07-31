import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout tagline="Recruiter sign in">
      <h2 className="text-2xl font-semibold tracking-tight text-mist-100">Welcome back</h2>
      <p className="mt-1.5 text-sm text-mist-400">Sign in to keep ranking candidates.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-mist-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 outline-none transition focus:border-verified-500 focus:ring-2 focus:ring-verified-500/20"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-mist-300">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 outline-none transition focus:border-verified-500 focus:ring-2 focus:ring-verified-500/20"
            placeholder="••••••••"
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
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-mist-400">
        No account yet?{" "}
        <Link to="/register" className="font-medium text-verified-400 hover:text-verified-300">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
