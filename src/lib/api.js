import { getToken, clearSession } from "./auth.js";

/**
 * Vite env:
 *   .env.development  -> VITE_API_BASE=http://localhost:4000
 *   .env.production   -> VITE_API_BASE=https://backend-hidden-fog-2243.fly.dev
 *
 * GitHub Pages needs the production value baked at build time (npm run build).
 */
const RAW_BASE = (import.meta.env.VITE_API_BASE || "").trim();

/**
 * Sensible fallback only for local dev convenience.
 * In production builds, you should ALWAYS set VITE_API_BASE.
 */
const FALLBACK_DEV_BASE = "http://localhost:4000";

const API_BASE = (RAW_BASE || (import.meta.env.DEV ? FALLBACK_DEV_BASE : "")).replace(/\/+$/, "");

/**
 * Join base + path safely.
 */
function buildUrl(path, query) {
  const p = String(path || "").trim();
  const normalizedPath = p.startsWith("/") ? p : `/${p}`;

  if (!API_BASE) {
    throw new Error(
      "VITE_API_BASE is not set. Example: VITE_API_BASE=https://backend-hidden-fog-2243.fly.dev"
    );
  }

  const url = new URL(`${API_BASE}${normalizedPath}`);

  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

/**
 * Robust response parsing:
 * - Handles JSON and non-JSON responses
 * - Handles 204 No Content
 */
async function parseResponse(res) {
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await res.text();
    return text ? { message: text } : null;
  } catch {
    return null;
  }
}

/**
 * FIXES:
 * - Do NOT set Content-Type unless there is a body (prevents extra preflight / weirdness)
 * - Support query param via options.query
 * - Provide clearer error messages on fetch failures
 * - Preserve caller-provided headers
 */
export async function api(path, options = {}) {
  const token = getToken();

  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;

  // Only set JSON content-type when:
  // - request has a body
  // - body is not FormData
  // - caller didn't set Content-Type
  if (hasBody && !headers.has("Content-Type") && !isFormDataBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = buildUrl(path, options.query);

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      mode: "cors",
    });
  } catch (err) {
    // This is where CORS/DNS/network failures end (fetch throws).
    // Return a cleaner error string.
    const hint = API_BASE ? `API_BASE=${API_BASE}` : "API_BASE not set";
    throw new Error(`${err?.message || "Network error contacting API"} (${hint})`);
  }

  const data = await parseResponse(res);

  if (res.status === 401) clearSession();

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && data.message) ||
      `Request failed (${res.status})`;

    throw new Error(msg);
  }

  return data;
}

/* Convenience helpers */

export const get = (path, query, options = {}) =>
  api(path, { ...options, method: "GET", query });

export const post = (path, body, options = {}) =>
  api(path, {
    ...options,
    method: "POST",
    body: isFormDataBody(body) ? body : JSON.stringify(body ?? {}),
  });

export const put = (path, body, options = {}) =>
  api(path, {
    ...options,
    method: "PUT",
    body: isFormDataBody(body) ? body : JSON.stringify(body ?? {}),
  });

export const del = (path, options = {}) =>
  api(path, { ...options, method: "DELETE" });

export { API_BASE };
