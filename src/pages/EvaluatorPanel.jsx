import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { clearSession, getUser } from "../lib/auth";
import { useNavigate } from "react-router-dom";

export default function EvaluatorPanel() {
  const navigate = useNavigate();
  const user = getUser();

  const [presenters, setPresenters] = useState([]);
  const [criteria, setCriteria] = useState([]);

  const [search, setSearch] = useState("");

  const [activePresenter, setActivePresenter] = useState(null);
  const [scoreMap, setScoreMap] = useState({}); // criterionId -> score (string/number)

  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const loadAll = async () => {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api("/api/evaluator/presenters"), api("/api/evaluator/evaluation-criteria")]);
      setPresenters(p?.presenters || []);
      setCriteria((c?.criteria || []).slice().sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999)));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ---------------------------------------
     ✅ FIX: lock background scroll while modal open (mobile + web)
  --------------------------------------- */
  useEffect(() => {
    if (!activePresenter) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const prevTouchAction = document.body.style.touchAction;

    // prevent layout shift when scrollbar disappears (desktop)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none"; // helps on mobile
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [activePresenter]);

  /* ---------------------------------------
     ✅ Optional: ESC to close modal
  --------------------------------------- */
  useEffect(() => {
    if (!activePresenter) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeEvaluate();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePresenter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return presenters;

    return presenters.filter((p) => {
      const a = String(p.fullName || "").toLowerCase();
      const b = String(p.username || "").toLowerCase();
      const c = String(p.topic?.title || "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [presenters, search]);

  const openEvaluate = (p) => {
    setErr("");
    setMsg("");
    setActivePresenter(p);

    const init = {};
    for (const c of criteria) init[c._id] = "";
    setScoreMap(init);

    setComment("");
  };

  const closeEvaluate = () => {
    setActivePresenter(null);
    setScoreMap({});
    setComment("");
  };

  const total = useMemo(() => {
    let sum = 0;
    for (const c of criteria) {
      const v = scoreMap[c._id];
      const n = parseInt(String(v), 10);
      if (Number.isInteger(n)) sum += n;
    }
    return sum;
  }, [criteria, scoreMap]);

  const allScored = useMemo(() => {
    if (!criteria.length) return false;
    for (const c of criteria) {
      const n = parseInt(String(scoreMap[c._id]), 10);
      if (!Number.isInteger(n) || n < 1 || n > 10) return false;
    }
    return true;
  }, [criteria, scoreMap]);

  const submit = async () => {
    setErr("");
    setMsg("");

    if (!activePresenter?._id) return setErr("No presenter selected.");
    if (!criteria.length) return setErr("No active criteria found. Ask admin to add/activate criteria.");
    if (!allScored) return setErr("Please enter a score (1–10) for every criterion.");

    const payload = {
      presenterId: activePresenter._id,
      scores: criteria.map((c) => ({
        criterionId: c._id,
        score: parseInt(String(scoreMap[c._id]), 10),
      })),
      comment: comment.trim(),
    };

    try {
      const res = await api("/api/evaluator/evaluations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMsg(`Evaluation submitted. Total score: ${res.totalScore}.`);
      closeEvaluate();
      loadAll();
    } catch (e) {
      setErr(e.message);
    }
  };

  /* ---------------------------------------
     ✅ FIX: stop scroll chaining from modal to background
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

  const stopTouchMove = (e) => {
    // keep touch scroll inside modal only
    e.stopPropagation();
  };

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
                Evaluator Session
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Evaluation Panel</h1>
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

          {/* Criteria summary */}
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Active Criteria</div>
                <div className="text-xs text-neutral-400 mt-1">Evaluations require scoring all active criteria (1–10 each).</div>
              </div>
              <div className="text-xs text-neutral-300">{criteria.length ? `${criteria.length} active criteria` : "No active criteria"}</div>
            </div>

            {criteria.length ? (
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {criteria.map((c) => (
                  <div key={c._id} className="rounded-xl bg-neutral-950/60 border border-neutral-800 p-4">
                    <div className="text-xs text-neutral-400">Order {c.order}</div>
                    <div className="mt-1 font-medium">{c.title}</div>
                    {c.description ? <div className="mt-1 text-xs text-neutral-500">{c.description}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-neutral-400">Ask the admin to add/activate criteria in the Admin Panel.</div>
            )}
          </div>

          {/* Search + list */}
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Presenters to Evaluate</h2>
                <div className="text-xs text-neutral-400 mt-1">Only presenters who spun the wheel are shown.</div>
              </div>

              <div className="w-full md:w-96">
                <div className="relative">
                  <input
                    className="w-full p-3 pl-10 rounded-xl bg-neutral-950/60 border border-neutral-800 outline-none focus:border-neutral-600 transition"
                    placeholder="Search by name, username, topic..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                    <th className="text-left font-medium py-3 pr-3">Topic</th>
                    <th className="text-right font-medium py-3">Action</th>
                    <th className="text-right font-medium py-3 pr-3">My Status</th>
                  </tr>
                </thead>

                <tbody className="text-neutral-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="py-4 text-neutral-400" colSpan={6}>
                        {loading ? "Loading..." : "No presenters found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const done = !!p.myEvaluation;
                      return (
                        <tr key={p._id} className="border-t border-neutral-800 hover:bg-neutral-950/40 transition">
                          <td className="py-3 pr-3">
                            <div className="font-medium">{p.fullName || "-"}</div>
                          </td>

                          <td className="py-3 pr-3">
                            {p.topic?.title ? (
                              <div className="max-w-[520px]">
                                <div className="text-neutral-100">{p.topic.title}</div>
                                {p.topic.description ? (
                                  <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{p.topic.description}</div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-neutral-500">-</span>
                            )}
                          </td>

                          <td className="py-3 text-right">
                            <button
                              disabled={done}
                              onClick={() => openEvaluate(p)}
                              className={[
                                "px-3 py-1.5 rounded-lg border text-xs transition",
                                done
                                  ? "bg-neutral-900/40 border-neutral-800 text-neutral-500 cursor-not-allowed"
                                  : "bg-neutral-950/60 border-neutral-800 hover:bg-neutral-950 text-neutral-200",
                              ].join(" ")}
                            >
                              {done ? "Done" : "Evaluate"}
                            </button>
                          </td>

                          <td className="py-3 pr-3">
                            {done ? (
                              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                                Evaluated (Total: {p.myEvaluation.totalScore})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Messages */}
          {msg && <div className="rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3">{msg}</div>}
          {err && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3">{err}</div>}
        </div>
      </div>

      {/* Evaluate Modal */}
      {activePresenter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={closeEvaluate} />

          <div className="relative w-full max-w-2xl rounded-2xl bg-neutral-950 border border-neutral-800 shadow-xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-neutral-800 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="text-sm text-neutral-400">Evaluating</div>
                <div className="text-lg font-semibold truncate">{activePresenter.fullName}</div>
                <div className="text-xs text-neutral-500 mt-1 truncate">Topic: {activePresenter.topic?.title || "-"}</div>
              </div>
              <button
                onClick={closeEvaluate}
                className="px-3 py-1.5 rounded-lg bg-neutral-900/70 border border-neutral-800 hover:bg-neutral-900 transition text-sm"
              >
                Close
              </button>
            </div>

            {/* Body (scrollable + prevents scroll chaining) */}
            <div
              className="p-5 space-y-4 flex-1 overflow-y-auto"
              onWheel={stopScrollChaining}
              onTouchMove={stopTouchMove}
              style={{ overscrollBehavior: "contain" }}
            >
              {!criteria.length ? (
                <div className="text-sm text-neutral-400">No active criteria. Ask admin to activate criteria first.</div>
              ) : (
                <div className="space-y-3">
                  {criteria.map((c) => (
                    <div key={c._id} className="rounded-xl bg-neutral-900/40 border border-neutral-800 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs text-neutral-400">Order {c.order}</div>
                          <div className="font-medium break-words">{c.title}</div>
                          {c.description ? <div className="text-xs text-neutral-500 mt-1 break-words">{c.description}</div> : null}
                        </div>

                        <div className="w-full sm:w-[220px]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] text-neutral-500">Score</span>
                            <span className="text-sm font-semibold text-white">
                              {scoreMap[c._id] === "" || scoreMap[c._id] == null ? "-" : scoreMap[c._id]}
                            </span>
                          </div>

                          <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            value={scoreMap[c._id] === "" || scoreMap[c._id] == null ? 5 : Number(scoreMap[c._id])}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              if (!Number.isFinite(n)) return;
                              setScoreMap((m) => ({ ...m, [c._id]: n }));
                            }}
                            className="w-full accent-red-600"
                          />

                          <div className="mt-2 grid grid-cols-10 gap-1 text-[11px]">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                              const active = Number(scoreMap[c._id]) === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setScoreMap((m) => ({ ...m, [c._id]: n }))}
                                  className={[
                                    "text-center rounded-md transition",
                                    "hover:bg-red-600/20",
                                    active ? "text-white font-semibold bg-red-600/30" : "text-neutral-500",
                                  ].join(" ")}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Comment box */}
                  <div className="rounded-xl bg-neutral-900/40 border border-neutral-800 p-4">
                    <div className="text-sm font-medium">Comment (optional)</div>
                    <div className="text-xs text-neutral-500 mt-1">Max 1500 characters.</div>

                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      maxLength={1500}
                      placeholder="Write your feedback..."
                      className="mt-3 w-full resize-none rounded-xl bg-neutral-950/60 border border-neutral-800 p-3 text-sm text-white outline-none focus:border-neutral-600 transition"
                    />

                    <div className="mt-2 text-xs text-neutral-500 text-right">{comment.trim().length}/1500</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-5 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-neutral-300">
                  Total: <span className="font-semibold text-white">{total}</span>
                </div>

                <button
                  onClick={submit}
                  disabled={!criteria.length || !allScored}
                  className={[
                    "px-5 py-2.5 rounded-xl font-medium transition border",
                    !criteria.length || !allScored
                      ? "bg-neutral-900/40 border-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700 border-red-500/30 text-white",
                  ].join(" ")}
                >
                  Submit Evaluation
                </button>
              </div>

              {!allScored && criteria.length ? (
                <div className="mt-2 text-xs text-neutral-500">You must score every criterion before submitting.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
