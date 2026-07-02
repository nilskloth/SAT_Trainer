/* =========================================================
   Proxy client. The browser sends only structured data —
   {token, op, payload} — to api/proxy.php; every prompt,
   model and cap lives server-side. All calls resolve or
   throw within the timeout so the caller can fall back to
   self-marking.
   ========================================================= */

import { getStore } from "./store.js";

const PROXY_URL = "api/proxy.php";
const TIMEOUT_MS = 8000;
const MARK_TIMEOUT_MS = 30000;

async function call(op, payload, timeoutMs) {
  const token = getStore().settings.proxyToken;
  if (!token) throw new Error("no-token");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, op, payload }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json();
  if (!body.ok) {
    const err = new Error(body.error?.message || "proxy-error");
    err.code = body.error?.code || "unknown";
    err.retryAfter = body.error?.retryAfter;
    throw err;
  }
  return body;
}

export async function ping() {
  const body = await call("ping", {}, TIMEOUT_MS);
  return body.data;
}

/*
 * AI-mark one free-text answer. Returns {earned, possible, feedback,
 * matchedPoints} or throws (caller falls back to self-marking).
 */
export async function markAI(q, answer, passageExcerpt) {
  const payload = {
    stem: String(q.stem || "").slice(0, 4000),
    marks: q.marks,
    markScheme: q.markScheme || {},
    answer: String(answer || "").slice(0, 4000)
  };
  if (passageExcerpt) payload.passageExcerpt = String(passageExcerpt).slice(0, 6000);

  const body = await call("mark", payload, MARK_TIMEOUT_MS);
  const d = body.data;

  if (!Number.isInteger(d.marks) || typeof d.feedback !== "string") {
    throw new Error("bad-mark-response");
  }
  return {
    earned: Math.max(0, Math.min(q.marks, d.marks)),
    possible: q.marks,
    feedback: d.feedback,
    matchedPoints: Array.isArray(d.matchedPoints) ? d.matchedPoints : []
  };
}
