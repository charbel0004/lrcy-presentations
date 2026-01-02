import { getToken, clearSession } from "./auth.js";

const API_BASE = import.meta.env.VITE_API_BASE;

export async function api(path, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (res.status === 401) clearSession();

  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}
