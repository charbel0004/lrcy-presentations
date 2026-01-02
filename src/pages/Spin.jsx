import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import SpinWheel from "../components/SpinWheel.jsx";
import { getUser } from "../lib/auth.js";

export default function Spin() {
  const navigate = useNavigate();
  const user = getUser();

  const [rotation, setRotation] = useState(0); // degrees
  const [spinning, setSpinning] = useState(false);
  const [err, setErr] = useState("");
  const [labels, setLabels] = useState(["Loading topics..."]);

  const rotationRad = useMemo(() => (rotation * Math.PI) / 180, [rotation]);

  const loadTopics = async () => {
    try {
      const d = await api("/api/topics/available");
      const titles = (d?.topics || []).map((t) => t.title);
      setLabels(titles.length ? titles : ["No topics available"]);
    } catch {
      setLabels(["No topics available"]);
    }
  };

  useEffect(() => {
    api("/api/presenter/me")
      .then((data) => {
        if (data?.hasSpun) navigate("/result");
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    loadTopics();
  }, []);

  const normDeg = (deg) => ((deg % 360) + 360) % 360;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Pointer is DOWN now (90°).
  // We want slice center to land at 90°.
  const spinToIndex = (index, totalItems) => {
    const slice = 360 / totalItems;
    const sliceCenterDeg = index * slice + slice / 2;

    const targetPointerDeg = 90; // ▼ at bottom

    const desiredRotation = normDeg(targetPointerDeg - sliceCenterDeg);

    const extraSpins = 5 * 360;
    return extraSpins + desiredRotation;
  };

  const spin = async () => {
    if (spinning) return;
    setErr("");

    if (
      !labels.length ||
      labels[0] === "No topics available" ||
      labels[0] === "Loading topics..."
    ) {
      setErr("No topics available to spin.");
      return;
    }

    setSpinning(true);

    try {
      const res = await api("/api/presenter/spin", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const assignedTitle = res?.topic?.title;
      const assignedDesc = res?.topic?.description || "";

      localStorage.setItem("assignedTopicTitle", assignedTitle);
      localStorage.setItem("assignedTopicDesc", assignedDesc);

      const total = labels.length;
      const idx = labels.findIndex((t) => t === assignedTitle);

      const startRotation = rotation;

      // If edge-case mismatch, just do random spin visually
      const addRotation =
        idx === -1
          ? Math.floor(Math.random() * 360) + 1800
          : spinToIndex(idx, total);

      const target = startRotation + addRotation;
      const duration = 2600;
      const start = performance.now();

      const animate = (t) => {
        const p = Math.min((t - start) / duration, 1);
        const e = easeOutCubic(p);
        setRotation(startRotation + (target - startRotation) * e);
        if (p < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);

      setTimeout(() => navigate("/result"), 1200);
    } catch (e) {
      setErr(e.message || "Spin failed.");
      setSpinning(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl bg-red-600/20" />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl bg-white/10" />
      </div>

      <div className="w-full max-w-2xl relative">
        <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/10 to-transparent shadow-2xl">
          <div className="bg-neutral-900/80 backdrop-blur rounded-2xl p-7 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Spin the wheel
                </h1>
                <p className="text-sm text-neutral-400 mt-1">
                  Presenter:{" "}
                  <span className="text-neutral-200">
                    {user?.fullName || user?.username}
                  </span>
                </p>
              </div>

              <button
                onClick={spin}
                disabled={spinning}
                className="px-6 py-3 rounded-xl font-medium
                           bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition shadow-lg shadow-red-600/10"
              >
                {spinning ? "Spinning..." : "Spin"}
              </button>
            </div>

            {/* Wheel */}
            <div className="mt-7 flex justify-center">
              <div className="relative">
                {/* soft glow behind wheel */}
                <div className="absolute inset-0 rounded-full blur-2xl bg-red-600/10" />

                <div className="relative">
                  <SpinWheel labels={labels} rotationRad={rotationRad} />

                  {/* DOWN + WHITE pointer (kept exactly as you had it) */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-4xl leading-none select-none drop-shadow">
                    ▼
                  </div>

                  {/* center cap */}
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                               w-14 h-14 rounded-full bg-neutral-950/70 border border-white/10 shadow-lg"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {err && (
              <div className="mt-6 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                {err}
              </div>
            )}

            {/* Footer note */}
            <div className="mt-6 text-xs text-neutral-500 text-center">
              The topic is assigned by the server and locked. You cannot spin
              twice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
