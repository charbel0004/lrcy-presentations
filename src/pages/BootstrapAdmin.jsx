import { useState } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function BootstrapAdmin() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const create = async () => {
    setErr("");
    setMsg("");

    if (fullName.trim().length < 3) return setErr("Full name required.");
    if (username.trim().length < 3) return setErr("Username required.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");

    try {
      const res = await api("/api/bootstrap/admin", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          password,
        }),
      });

      setMsg(`Admin created successfully. ID: ${res.adminId}`);
      setTimeout(() => navigate("/login"), 900);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-neutral-800 rounded-xl p-6">
        <h1 className="text-xl font-semibold text-center mb-4">Bootstrap Admin</h1>

        <div className="space-y-3">
          <input
            className="w-full p-3 rounded bg-neutral-700 outline-none"
            placeholder="Admin full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="w-full p-3 rounded bg-neutral-700 outline-none"
            placeholder="Admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="w-full p-3 rounded bg-neutral-700 outline-none"
            placeholder="Admin password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {msg && <div className="text-sm text-green-400">{msg}</div>}
          {err && <div className="text-sm text-red-400">{err}</div>}

          <button onClick={create} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded">
            Create Admin
          </button>

          <div className="text-xs text-neutral-400">
            Use once. If admin already exists, the server will refuse.
          </div>
        </div>
      </div>
    </div>
  );
}
