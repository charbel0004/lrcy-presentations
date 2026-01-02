import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const submit = async () => {
    if (loading) return;

    setErr("");
    const u = username.trim().toLowerCase();

    if (u.length < 3) return setErr("Enter a valid username.");
    if (!password) return setErr("Enter your password.");

    setLoading(true);
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: u, password }),
      });

      setSession(res.token, res.user);
      navigate(res.user.role === "admin" ? "/admin" : "/spin");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      {/* Subtle background accents */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl bg-red-600/20" />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl bg-white/10" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/10 to-transparent shadow-2xl">
          <div className="bg-neutral-900/80 backdrop-blur rounded-2xl p-7">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-600/15 border border-red-600/25 mb-3">
                <span className="text-red-400 text-xl font-bold">LRC</span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight">
                LRCY Presentations
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Sign in to get your randomly assigned topic.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-400">Username</label>
                <input
                  ref={userRef}
                  className="w-full p-3 rounded-xl bg-neutral-800/70 border border-white/10 outline-none
                             focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 transition"
                  placeholder="e.g., racha.k"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={onKeyDown}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-400">Password</label>
                <div className="relative">
                  <input
                    className="w-full p-3 pr-12 rounded-xl bg-neutral-800/70 border border-white/10 outline-none
                               focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 transition"
                    placeholder="Your password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onKeyDown}
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg
                               text-xs text-neutral-300 hover:text-white hover:bg-white/10 transition"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {err && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  {err}
                </div>
              )}

              <button
                onClick={submit}
                disabled={loading}
                className="w-full py-3 rounded-xl font-medium
                           bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition shadow-lg shadow-red-600/10"
              >
                {loading ? "Signing in..." : "Login"}
              </button>

              <div className="text-xs text-neutral-400 text-center pt-1">
                No account? Ask the admin to create one.
              </div>
            </div>

            {/* Footer hint */}
            <div className="mt-6 text-center text-[11px] text-neutral-500">
              Tip: Press <span className="text-neutral-300">Enter</span> to log in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
