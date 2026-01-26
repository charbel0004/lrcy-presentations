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
  const [critOrder, setCritOrder] = useState(1); // allow "" in onChange
  const [critActive, setCritActive] = useState(true);

  /* ---------------------------------------
     ✅ Reports state
  --------------------------------------- */
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportSearch, setReportSearch] = useState("");

  // ✅ needed for expand/collapse
  const [openPresenterId, setOpenPresenterId] = useState(null);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  // Navigate to evaluation page
  const goEvaluate = (presenterId) => {
    navigate(`/admin/evaluate/${presenterId}`);
  };

  const loadCore = async () => {
    try {
      const [ov, pr] = await Promise.all([api("/api/admin/overview"), api("/api/admin/presenters")]);
      setOverview(ov);
      setPresenters(pr?.presenters || []);
    } catch (e) {
      setErr(e.message);
    }
  };

  const loadCriteria = async () => {
    try {
      const cr = await api("/api/admin/evaluation-criteria");
      setCriteria(cr?.criteria || []);
    } catch (e) {
      setErr((prev) => prev || e.message);
    }
  };

  const loadAll = async () => {
    setErr("");
    await Promise.all([loadCore(), loadCriteria()]);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------
     ✅ FIX: lock background scroll while modal open
  --------------------------------------- */
  useEffect(() => {
    if (!reportOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // prevent layout shift when scrollbar disappears
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [reportOpen]);

  /* ---------------------------------------
     ✅ Optional: ESC to close modal
  --------------------------------------- */
  useEffect(() => {
    if (!reportOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setReportOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reportOpen]);

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
      loadCore();
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

  /* ---------------------------------------
     ✅ Reports helpers
  --------------------------------------- */
  const round2 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "-";
    return (Math.round(x * 100) / 100).toFixed(2);
  };

  const loadReports = async () => {
    setErr("");
    setMsg("");
    setReportLoading(true);

    try {
      const res = await api("/api/admin/presenters-reports");
      setReports(res?.presenters || []);
      setOpenPresenterId(null);
      setReportOpen(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setReportLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return reports;

    return reports.filter((p) => {
      const a = (p.fullName || "").toLowerCase();
      const b = (p.username || "").toLowerCase();
      const c = (p.topic?.title || "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [reports, reportSearch]);

  /* ---------------------------------------
     ✅ FIX: stop scroll chaining (wheel + touch)
  --------------------------------------- */
  const stopScrollChaining = (e) => {
    const el = e.currentTarget;
    if (!el) return;

    const canScroll = el.scrollHeight > el.clientHeight;
    if (!canScroll) {
      e.preventDefault?.();
      e.stopPropagation();
      return;
    }

    const deltaY = e.deltaY ?? 0;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

    if ((atTop && deltaY < 0) || (atBottom && deltaY > 0)) {
      e.preventDefault?.();
      e.stopPropagation();
    }
  };

  const stopTouchChaining = (e) => {
    e.stopPropagation();
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

              {/* Reports button + existing search */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                <button
                  onClick={loadReports}
                  disabled={reportLoading}
                  className={[
                    "px-4 py-3 rounded-xl border transition text-sm whitespace-nowrap",
                    reportLoading
                      ? "bg-neutral-950/40 border-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-neutral-900/70 border-neutral-800 hover:bg-neutral-900 text-white",
                  ].join(" ")}
                  title="View report for each presenter"
                >
                  {reportLoading ? "Generating..." : "Presenter Reports"}
                </button>

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
                    <th className="text-right font-medium py-3 pr-3">Action</th>
                  </tr>
                </thead>

                <tbody className="text-neutral-100">
                  {filteredPresenters.length === 0 ? (
                    <tr>
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

              <div className="mt-2 text-xs text-neutral-500">Tip: paste a list from Notes/Excel—each line becomes a topic.</div>
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
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return setCritOrder("");
                      const n = parseInt(v, 10);
                      setCritOrder(Number.isFinite(n) ? n : "");
                    }}
                    placeholder="Order"
                  />

                  <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
                    <input type="checkbox" className="h-4 w-4" checked={critActive} onChange={(e) => setCritActive(e.target.checked)} />
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
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3">{msg}</div>
          )}
          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3">{err}</div>
          )}
        </div>
      </div>

      {/* ---------------------------------------
          ✅ Reports Modal (scroll locked + no background scroll)
      --------------------------------------- */}
      {reportOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReportOpen(false)} />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-6xl rounded-2xl bg-neutral-950 border border-neutral-800 shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 border-b border-neutral-800">
                <div>
                  <div className="text-sm font-semibold">Presenter Reports</div>
                  <div className="text-xs text-neutral-400">
                    Each presenter: # evaluators, totals, average, and evaluator comments.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    className="w-72 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 outline-none focus:border-neutral-600 transition text-sm"
                    placeholder="Search presenter / username / topic..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                  />
                  <button
                    onClick={() => setReportOpen(false)}
                    className="px-3 py-2 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:bg-neutral-900 transition text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Body (✅ prevents scroll chaining to background) */}
              <div
                className="p-4 overflow-auto max-h-[75vh] space-y-3"
                onWheel={stopScrollChaining}
                onTouchMove={stopTouchChaining}
                style={{ overscrollBehavior: "contain" }}
              >
                {filteredReports.length === 0 ? (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
                    No report rows found.
                  </div>
                ) : (
                  filteredReports.map((p) => {
                    const isOpen = openPresenterId === String(p._id);
                    const topicTitle = p.topic?.title || "-";
                    const avg =
                      p.avgTotalScore === null || p.avgTotalScore === undefined ? "-" : round2(p.avgTotalScore);
                    const sum = p.sumTotalScore ?? 0;
                    const evalCount = p.evalCount ?? 0;

                    return (
                      <div key={p._id} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
                        {/* Card Header */}
                        <button
                          type="button"
                          onClick={() => setOpenPresenterId(isOpen ? null : String(p._id))}
                          className="w-full text-left p-4 hover:bg-neutral-950/30 transition"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-base font-semibold text-white truncate">{p.fullName || "-"}</div>
                                <span className="text-xs text-neutral-400">({p.username || "-"})</span>

                                <span
                                  className={[
                                    "ml-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs",
                                    isOpen
                                      ? "bg-red-600/10 border-red-500/20 text-red-200"
                                      : "bg-neutral-950/40 border-neutral-800 text-neutral-300",
                                  ].join(" ")}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                                  {isOpen ? "Hide details" : "View details"}
                                </span>
                              </div>

                              <div className="mt-1 text-sm text-neutral-300 truncate">
                                Topic: <span className="text-neutral-100">{topicTitle}</span>
                              </div>

                              <div className="mt-1 text-xs text-neutral-500">Assigned: {fmt(p.assignedAt)}</div>
                            </div>

                            {/* Summary chips */}
                            <div className="flex items-center gap-2 flex-wrap md:justify-end">
                              <span className="px-3 py-1 rounded-full bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200">
                                Evaluators: <span className="font-semibold">{evalCount}</span>
                              </span>
                              <span className="px-3 py-1 rounded-full bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200">
                                Avg: <span className="font-semibold">{avg}</span>
                              </span>
                              <span className="px-3 py-1 rounded-full bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-200">
                                Sum: <span className="font-semibold">{sum}</span>
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Expanded */}
                        {isOpen && (
                          <div className="border-t border-neutral-800 p-4 space-y-3">
                            {p.topic?.description ? (
                              <div className="rounded-xl bg-neutral-950/40 border border-neutral-800 p-3">
                                <div className="text-xs text-neutral-400 mb-1">Topic description</div>
                                <div className="text-sm text-neutral-200 whitespace-pre-wrap">{p.topic.description}</div>
                              </div>
                            ) : null}

                            <div className="text-xs text-neutral-400">
                              Evaluations ({Array.isArray(p.evaluations) ? p.evaluations.length : 0})
                            </div>

                            {Array.isArray(p.evaluations) && p.evaluations.length ? (
                              <div className="grid md:grid-cols-2 gap-3">
                                {p.evaluations.map((e) => {
                                  const hasComment = String(e.comment || "").trim().length > 0;

                                  return (
                                    <div key={e._id} className="rounded-2xl bg-neutral-950/40 border border-neutral-800 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold text-neutral-100 truncate">
                                            {e.evaluatorName || "Unknown evaluator"}
                                            {e.evaluatorUsername ? (
                                              <span className="text-xs text-neutral-500"> ({e.evaluatorUsername})</span>
                                            ) : null}
                                          </div>
                                          <div className="text-xs text-neutral-500 mt-0.5">{fmt(e.createdAt)}</div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                          <div className="text-lg font-semibold text-white">{e.totalScore ?? 0}</div>
                                          <div className="text-xs text-neutral-500">total score</div>
                                        </div>
                                      </div>

                                      <div className="mt-3">
                                        <div className="text-xs text-neutral-400 mb-1">Comment</div>
                                        {hasComment ? (
                                          <div className="text-sm text-neutral-200 whitespace-pre-wrap rounded-xl bg-neutral-900/50 border border-neutral-800 p-3">
                                            {String(e.comment).trim()}
                                          </div>
                                        ) : (
                                          <div className="text-sm text-neutral-500 italic">No comment.</div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-neutral-800 bg-neutral-950/30 p-4 text-sm text-neutral-500">
                                No evaluations yet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div className="pt-2 text-xs text-neutral-500">
                  Average is computed from <span className="text-neutral-300">evaluation.totalScore</span> across evaluators.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
