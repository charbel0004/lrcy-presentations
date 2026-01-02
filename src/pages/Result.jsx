import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { getUser } from "../lib/auth";

export default function Result() {
  const navigate = useNavigate();
  const user = getUser();

  const [topic, setTopic] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/presenter/me")
      .then((data) => {
        if (!data?.hasSpun || !data?.topic) return navigate("/spin");
        setTopic(data.topic);
      })
      .catch((e) => {
        setErr(e.message);
        const t = localStorage.getItem("assignedTopicTitle");
        const d = localStorage.getItem("assignedTopicDesc");
        if (t) setTopic({ title: t, description: d || "" });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute -bottom-40 right-10 h-[360px] w-[360px] rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Assigned topic (locked)
            </div>

            <h1 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight">
              Your Presentation Topic
            </h1>

            <p className="mt-2 text-sm text-white/60">
              Presenter:{" "}
              <span className="text-white/80 font-medium">
                {user?.fullName || user?.username}
              </span>
            </p>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_10px_45px_-20px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="p-6 md:p-8">
              {err ? (
                <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              ) : null}

              {topic ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-neutral-950/30 px-5 py-4">
                    <div className="text-xs text-white/60 mb-2">Topic</div>
                    <div className="text-xl md:text-2xl font-semibold text-white leading-snug">
                      {topic.title}
                    </div>

                    {topic.description ? (
                      <>
                        <div className="mt-4 h-px bg-white/10" />
                        <div className="mt-4 text-sm text-white/75 leading-relaxed">
                          {topic.description}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950/20 px-4 py-3 text-xs text-white/60">
                    This result is locked. You cannot spin again.
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigate("/login")}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 transition disabled:opacity-60 font-medium"
                    >
                      Back to Login
                    </button>

                    <button
                      onClick={() => navigator.clipboard?.writeText(topic.title)}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/80"
                    >
                      Copy topic title
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                  Loading your assigned topic...
                </div>
              )}
            </div>

            <div className="px-6 md:px-8 py-4 border-t border-white/10 bg-neutral-950/20 text-xs text-white/50">
              LRCY Presentations • Random assignment system
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
