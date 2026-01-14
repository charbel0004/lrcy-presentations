import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { clearSession, getUser } from "../lib/auth";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();
  const user = getUser();

  const [overview, setOverview] = useState(null);
  const [presenters, setPresenters] = useState([]);
  const [presenterSearch, setPresenterSearch] = useState("");

  const [criteria, setCriteria] = useState([]);
  const [criteriaSearch, setCriteriaSearch] = useState("");

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [topicsBulk, setTopicsBulk] = useState("");

  // Create user
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("presenter"); // presenter | evaluator | admin

  // Criteria form
  const [critTitle, setCritTitle] = useState("");
  const [critDesc, setCritDesc] = useState("");
  // CHANGED: allow "" while user clears field, but still validate on submit
  const [critOrder, setCritOrder] = useState(1);
  const [critActive, setCritActive] = useState(true);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  // ✅ ADDED: navigate to evaluation page
  const goEvaluate = (presenterId) => {
    navigate(`/admin/evaluate/${presenterId}`);
  };

  const loadCore = async () => {
    // Core loads must NEVER be blocked by missing criteria endpoints.
    try {
      const [ov, pr] = await Promise.all([api("/api/admin/overview"), api("/api/admin/presenters")]);
      setOverview(ov);
      setPresenters(pr?.presenters || []);
    } catch (e) {
      setErr(e.message);
    }
  };

  const loadCriteria = async () => {
    // Criteria are optional until backend endpoints exist.
    try {
      const cr = await api("/api/admin/evaluation-criteria");
      setCriteria(cr?.criteria || []);
    } catch (e) {
      // Do not wipe other data. Just show a message.
      setErr((prev) => prev || e.message);
    }
  };

  const loadAll = async () => {
    setErr("");
    await Promise.all([loadCore(), loadCriteria()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addTopics = async () => {
    setErr("");
    setMsg("");

    const lines = topicsBulk
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const topics = lines.map((title) => ({ title }));
    if (!topics.length) return setErr("Please enter at least 1 topic.");

    try {
      const res = await api("/api/admin/topics", {
        method: "POST",
        body: JSON.stringify({ topics }),
      });
      setMsg(`Inserted ${res.inserted} topics.`);
      setTopicsBulk("");
      loadCore(); // keep it fast
    } catch (e) {
      setErr(e.message);
    }
  };

  const createUser = async () => {
    setErr("");
    setMsg("");

    const fn = fullName.trim();
    const un = username.trim().toLowerCase();
    const rl = String(role || "").trim();

    if (fn.length < 3) return setErr("Full name is required.");
    if (un.length < 3) return setErr("Username is required.");
    if (!password || password.length < 6) return setErr("Password must be at least 6 characters.");
    if (!["presenter", "evaluator", "admin"].includes(rl)) return setErr("Invalid role.");

    try {
      // IMPORTANT: backend must accept role
      const res = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ fullName: fn, username: un, password, role: rl }),
      });

      setMsg(`User created as ${rl} (id: ${res.userId}).`);
      setFullName("");
      setUsername("");
      setPassword("");
      setRole("presenter");
      loadCore();
    } catch (e) {
      setErr(e.message);
    }
  };

  const addCriterion = async () => {
    setErr("");
    setMsg("");

    const t = String(critTitle || "").trim();
    const d = String(critDesc || "").trim();

    // CHANGED: parse strictly as integer
    const ord = parseInt(String(critOrder), 10);

    if (t.length < 2) return setErr("Criterion title is required.");
    if (!Number.isInteger(ord) || ord < 1) return setErr("Order must be an integer >= 1.");

    try {
      await api("/api/admin/evaluation-criteria", {
        method: "POST",
        body: JSON.stringify({
          title: t,
          description: d || null,
          order: ord,
          isActive: !!critActive,
        }),
      });

      setMsg("Criterion added.");
      setCritTitle("");
      setCritDesc("");
      setCritOrder(1);
      setCritActive(true);
      loadCriteria();
    } catch (e) {
      setErr(e.message);
    }
  };

  const toggleCriterion = async (criterionId, nextActive) => {
    setErr("");
    setMsg("");

    try {
      await api(`/api/admin/evaluation-criteria/${criterionId}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !!nextActive }),
      });
      setMsg(`Criterion ${nextActive ? "activated" : "deactivated"}.`);
      loadCriteria();
    } catch (e) {
      setErr(e.message);
    }
  };

  const filteredPresenters = useMemo(() => {
    const q = presenterSearch.trim().toLowerCase();
    if (!q) return presenters;

    return presenters.filter((p) => {
      const a = (p.fullName || "").toLowerCase();
      const b = (p.username || "").toLowerCase();
      const c = (p.topicTitle || "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [presenters, presenterSearch]);

  const filteredCriteria = useMemo(() => {
    const q = criteriaSearch.trim().toLowerCase();
    const sorted = [...criteria].sort((x, y) => (x.order ?? 999999) - (y.order ?? 999999));

    if (!q) return sorted;

    return sorted.filter((c) => {
      const a = String(c.title || "").toLowerCase();
      const b = String(c.description || "").toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [criteria, criteriaSearch]);

  const fmt = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return "-";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15),transparent_55%)]" />

      <div className="relative p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs text-neutral-300 bg-neutral-900/60 border border-neutral-800 px-3 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-green-400/80" />
                Admin Session
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Admin Panel</h1>
              <div className="mt-1 text-sm text-neutral-400">
                Signed in as <span className="text-neutral-200">{user?.fullName}</span>{" "}
                <span className="text-neutral-500">({user?.username})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAll}
                className="px-4 py-2 rounded-lg bg-neutral-900/70 border border-neutral-800 hover:bg-neutral-900 transition"
              >
                Refresh
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-lg bg-neutral-900/70 border border-neutral-800 hover:bg-neutral-900 transition"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Overview cards */}
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ["Total Topics", overview.total],
                ["Available", overview.available],
                ["Assigned", overview.assigned],
                ["Presenters", overview.presenters],
                ["Spun", overview.spun],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4">
                  <div className="text-xs text-neutral-400">{k}</div>
                  <div className="mt-1 text-xl font-semibold">{v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Presenters table */}
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Presenters & Assigned Topics</h2>
                <div className="text-xs text-neutral-400 mt-1">Shows who spun, and which topic they received.</div>
              </div>

              <div className="w-full md:w-96">
                <div className="relative">
                  <input
                    className="w-full p-3 pl-10 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                    placeholder="Search by name, username, topic..."
                    value={presenterSearch}
                    onChange={(e) => setPresenterSearch(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">⌕</span>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-neutral-300 border-b border-neutral-800">
                    <th className="text-left font-medium py-3 pr-3">Presenter</th>
                    <th className="text-left font-medium py-3 pr-3">Username</th>
                    <th className="text-left font-medium py-3 pr-3">Status</th>
                    <th className="text-left font-medium py-3 pr-3">Topic</th>
                    <th className="text-left font-medium py-3 pr-3">Assigned At</th>
                    {/* ✅ ADDED */}
                    <th className="text-right font-medium py-3 pr-3">Action</th>
                  </tr>
                </thead>

                <tbody className="text-neutral-100">
                  {filteredPresenters.length === 0 ? (
                    <tr>
                      {/* ✅ CHANGED colSpan 5 -> 6 */}
                      <td className="py-4 text-neutral-400" colSpan={6}>
                        No presenters found.
                      </td>
                    </tr>
                  ) : (
                    filteredPresenters.map((p) => (
                      <tr key={p._id} className="border-t border-neutral-800 hover:bg-neutral-950/40 transition">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{p.fullName || "-"}</div>
                        </td>

                        <td className="py-3 pr-3 text-neutral-300">
                          <span className="px-2 py-1 rounded-lg bg-neutral-950/60 border border-neutral-800">
                            {p.username || "-"}
                          </span>
                        </td>

                        <td className="py-3 pr-3">
                          {p.hasSpun ? (
                            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                              Spun
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                              Not yet
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-3">
                          {p.topicTitle ? (
                            <div className="max-w-[520px]">
                              <div className="text-neutral-100">{p.topicTitle}</div>
                            </div>
                          ) : (
                            <span className="text-neutral-500">-</span>
                          )}
                        </td>

                        <td className="py-3 pr-3 text-neutral-300 whitespace-nowrap">{fmt(p.assignedAt)}</td>

                        {/* ✅ ADDED: Evaluate button */}
                        <td className="py-3 pr-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => goEvaluate(p._id)}
                            disabled={!p.hasSpun}
                            className={[
                              "px-3 py-1.5 rounded-lg border text-xs transition",
                              p.hasSpun
                                ? "bg-red-600 hover:bg-red-700 border-red-500/30 text-white"
                                : "bg-neutral-950/40 border-neutral-800 text-neutral-500 cursor-not-allowed",
                            ].join(" ")}
                            title={p.hasSpun ? "Evaluate this presenter" : "Presenter must spin first"}
                          >
                            Evaluate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Add Topics */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Add Topics</h2>
                <span className="text-xs text-neutral-500">One per line</span>
              </div>

              <textarea
                className="mt-3 w-full min-h-[220px] p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                placeholder={"Example:\nDisaster Preparedness\nHumanitarian Values\nPsychological First Aid"}
                value={topicsBulk}
                onChange={(e) => setTopicsBulk(e.target.value)}
              />

              <button
                onClick={addTopics}
                className="mt-4 w-full md:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition font-medium"
              >
                Add Topics
              </button>

              <div className="mt-2 text-xs text-neutral-500">
                Tip: paste a list from Notes/Excel—each line becomes a topic.
              </div>
            </div>

            {/* Create User */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6">
              <h2 className="text-base font-semibold">Create User Account</h2>

              <div className="mt-4 space-y-3">
                <input
                  className="w-full p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />

                <input
                  className="w-full p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                  placeholder="Username (e.g., racha.k)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />

                <input
                  className="w-full p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <select
                  className="w-full p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="presenter">Presenter</option>
                  <option value="evaluator">Evaluator</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  onClick={createUser}
                  className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition font-medium"
                >
                  Create User
                </button>

                <div className="text-xs text-neutral-400">
                  Users log in at{" "}
                  <span className="px-2 py-1 rounded-lg bg-neutral-950/60 border border-neutral-800 text-neutral-200">
                    /login
                  </span>
                  . Presenters can spin once; evaluators can score spun presenters.
                </div>
              </div>
            </div>

            {/* Evaluation Criteria */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Evaluation Criteria</h2>
                <button
                  onClick={loadCriteria}
                  className="px-3 py-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:bg-neutral-950 transition text-xs"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  className="w-full p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                  placeholder="Title (e.g., Clarity)"
                  value={critTitle}
                  onChange={(e) => setCritTitle(e.target.value)}
                />

                <textarea
                  className="w-full min-h-[90px] p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                  placeholder="Description (optional)"
                  value={critDesc}
                  onChange={(e) => setCritDesc(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="w-full p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                    type="number"
                    min={1}
                    step={1}
                    value={critOrder}
                    // CHANGED: robust integer handling + allow empty state while typing
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return setCritOrder("");
                      const n = parseInt(v, 10);
                      setCritOrder(Number.isFinite(n) ? n : "");
                    }}
                    placeholder="Order"
                  />

                  <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={critActive}
                      onChange={(e) => setCritActive(e.target.checked)}
                    />
                    Active
                  </label>
                </div>

                <button
                  onClick={addCriterion}
                  className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition font-medium"
                >
                  Add Criterion
                </button>
              </div>

              <div className="mt-5">
                <input
                  className="w-full p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition text-sm"
                  placeholder="Search criteria..."
                  value={criteriaSearch}
                  onChange={(e) => setCriteriaSearch(e.target.value)}
                />

                <div className="mt-3 max-h-[260px] overflow-auto rounded-xl border border-neutral-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-neutral-900/80 border-b border-neutral-800">
                      <tr className="text-neutral-300">
                        <th className="text-left font-medium py-2.5 px-3 w-[80px]">Order</th>
                        <th className="text-left font-medium py-2.5 px-3">Title</th>
                        <th className="text-left font-medium py-2.5 px-3">Status</th>
                        <th className="text-right font-medium py-2.5 px-3 w-[140px]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCriteria.length === 0 ? (
                        <tr>
                          <td className="py-4 px-3 text-neutral-400" colSpan={4}>
                            No criteria found (or endpoint not added yet).
                          </td>
                        </tr>
                      ) : (
                        filteredCriteria.map((c) => (
                          <tr key={c._id} className="border-t border-neutral-800 hover:bg-neutral-950/40 transition">
                            <td className="py-2.5 px-3 text-neutral-300">{c.order ?? "-"}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium">{c.title || "-"}</div>
                              {c.description ? (
                                <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{c.description}</div>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-3">
                              {c.isActive ? (
                                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-500/10 border border-neutral-500/20 text-neutral-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {c.isActive ? (
                                <button
                                  onClick={() => toggleCriterion(c._id, false)}
                                  className="px-3 py-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:bg-neutral-950 transition text-xs"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => toggleCriterion(c._id, true)}
                                  className="px-3 py-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:bg-neutral-950 transition text-xs"
                                >
                                  Activate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 text-xs text-neutral-500">Evaluators will only see active criteria. Scores are 1–10.</div>
              </div>
            </div>
          </div>

          {/* Messages */}
          {msg && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3">
              {msg}
            </div>
          )}
          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3">
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
