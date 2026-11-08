// Endpoint Vercel: /api/konsultan
// Meneruskan pertanyaan pengguna ke Gemini. API key disimpan di Environment
// Variable Vercel (GEMINI_API_KEY), jadi tidak pernah terlihat di browser.
const RULES = require("./_konsultan-rules.js");

const FIREBASE_WEB_API_KEY = "AIzaSyDaGcDbi4OdMj6UZtX1tnsWbUssCu7sd5k"; // kunci publik Firebase (sama dengan di browser)
const FIREBASE_PROJECT_ID = "sakugenius-app";
const MAX_QUESTION = 1000;
const MAX_HISTORY = 10;
const MAX_SUMMARY = 12000;

// Batas sederhana per pengguna (per instance server): 20 pertanyaan / 10 menit
const hits = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const list = (hits.get(uid) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(uid, list);
  return list.length > 20;
}

async function verifyMember(idToken) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) },
  );
  if (!r.ok) return null;
  const uid = (await r.json()).users?.[0]?.localId;
  if (!uid) return null;
  const m = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/members/${uid}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!m.ok) return null;
  const status = (await m.json()).fields?.status?.stringValue;
  return status === "approved" ? uid : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "Konsultan AI belum diaktifkan (GEMINI_API_KEY belum diisi di Vercel)." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const question = String(body.question || "").trim().slice(0, MAX_QUESTION);
  if (!question) return res.status(400).json({ error: "Pertanyaan kosong." });

  const auth = String(req.headers.authorization || "");
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const uid = idToken ? await verifyMember(idToken).catch(() => null) : null;
  if (!uid) return res.status(401).json({ error: "Sesi tidak valid. Silakan masuk ulang." });
  if (rateLimited(uid)) return res.status(429).json({ error: "Terlalu banyak pertanyaan. Coba lagi beberapa menit lagi." });

  const summary = JSON.stringify(body.summary || {}).slice(0, MAX_SUMMARY);
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-MAX_HISTORY)
    .map((h) => ({
      role: h.role === "model" ? "model" : "user",
      parts: [{ text: String(h.text || "").slice(0, 2000) }],
    }));

  const contents = [
    ...history,
    {
      role: "user",
      parts: [{ text: `RINGKASAN DATA KEUANGAN PENGGUNA (JSON):\n${summary}\n\nPERTANYAAN:\n${question}` }],
    },
  ];

  // Coba model dari GEMINI_MODEL dulu, lalu model cadangan bila model tidak ditemukan
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
    .filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: RULES }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  });

  let last = { status: 0, message: "" };
  for (const model of models) {
    try {
      const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: payload,
      });
      const data = await g.json().catch(() => ({}));
      if (g.ok) {
        const answer = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (!answer) return res.status(502).json({ error: "Konsultan AI tidak memberi jawaban. Coba ulangi pertanyaan." });
        return res.status(200).json({ answer, model });
      }
      last = { status: g.status, message: String(data.error?.message || "").slice(0, 300) };
      console.error("Gemini error", model, g.status, JSON.stringify(data).slice(0, 500));
      if (g.status !== 404) break; // model ada tapi ditolak: tidak perlu coba model lain
    } catch (e) {
      console.error(e);
      last = { status: 0, message: String(e.message || e).slice(0, 300) };
    }
  }

  const hint =
    last.status === 429
      ? "Kuota gratis Gemini sedang habis. Coba lagi nanti."
      : last.status === 400 && /api key/i.test(last.message)
        ? "API key Gemini tidak valid. Periksa GEMINI_API_KEY di Vercel."
        : last.status === 403
          ? "API key Gemini ditolak (izin/wilayah). Buat ulang key di aistudio.google.com."
          : last.status === 404
            ? "Model Gemini tidak ditemukan. Isi GEMINI_MODEL di Vercel dengan model yang tersedia."
            : "Konsultan AI sedang bermasalah. Coba lagi nanti.";
  return res.status(502).json({ error: `${hint} (kode ${last.status || "jaringan"}${last.message ? ": " + last.message : ""})` });
};
