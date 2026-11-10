// Endpoint Vercel: /api/konsultan
// Meneruskan pertanyaan pengguna ke Gemini. API key disimpan di Environment
// Variable Vercel (GEMINI_API_KEY), jadi tidak pernah terlihat di browser.
const RULES = require("./_konsultan-rules.js");

const FIREBASE_WEB_API_KEY = "AIzaSyDaGcDbi4OdMj6UZtX1tnsWbUssCu7sd5k"; // kunci publik Firebase (sama dengan di browser)
const FIREBASE_PROJECT_ID = "sakugenius-app";
const MAX_QUESTION = 1000;
const MAX_HISTORY = 10;
const MAX_SUMMARY = 12000;
// Jatah chat Konsultan per akun per bulan (bisa diubah lewat Environment Variable KONSULTAN_LIMIT)
const MONTHLY_LIMIT = Math.max(1, parseInt(process.env.KONSULTAN_LIMIT, 10) || 5);
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

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
    `${FIRESTORE}/members/${uid}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!m.ok) return null;
  const status = (await m.json()).fields?.status?.stringValue;
  return status === "approved" ? uid : null;
}

// ---------- Jatah chat bulanan ----------
// Disimpan di Firestore konsultanUsage/{uid} = { bulan: 202611, jumlah: 3 }.
// Aturan Firestore hanya mengizinkan jumlah naik 1 per tulis, jadi pengguna
// tidak bisa mengurangi atau mereset hitungannya sendiri.
function currentMonth() {
  const d = new Date(); // UTC, sama dengan request.time di aturan Firestore
  return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
}

async function readUsage(uid, idToken) {
  const r = await fetch(`${FIRESTORE}/konsultanUsage/${uid}`, { headers: { Authorization: `Bearer ${idToken}` } });
  if (r.status === 404) return { used: 0, updateTime: null };
  if (!r.ok) throw new Error(`usage read ${r.status}`);
  const doc = await r.json();
  const bulan = Number(doc.fields?.bulan?.integerValue || 0);
  const jumlah = Number(doc.fields?.jumlah?.integerValue || 0);
  return { used: bulan === currentMonth() ? jumlah : 0, updateTime: doc.updateTime, bulan, jumlah };
}

async function addUsage(uid, idToken) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const u = await readUsage(uid, idToken);
    const precondition = u.updateTime
      ? `currentDocument.updateTime=${encodeURIComponent(u.updateTime)}`
      : "currentDocument.exists=false";
    const r = await fetch(`${FIRESTORE}/konsultanUsage/${uid}?${precondition}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        fields: { bulan: { integerValue: String(currentMonth()) }, jumlah: { integerValue: String(u.used + 1) } },
      }),
    });
    if (r.ok) return u.used + 1;
    console.error("usage write", r.status, (await r.text()).slice(0, 300));
    if (r.status !== 400 && r.status !== 409) return null; // bukan bentrok, jangan diulang
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Gunakan POST." });

  const auth = String(req.headers.authorization || "");
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const uid = idToken ? await verifyMember(idToken).catch(() => null) : null;
  if (!uid) return res.status(401).json({ error: "Sesi tidak valid. Silakan masuk ulang." });

  let used;
  try {
    used = (await readUsage(uid, idToken)).used;
  } catch (e) {
    console.error("usage", e.message);
    return res.status(503).json({ error: "Batas chat Konsultan belum aktif: aturan Firestore (konsultanUsage) belum diperbarui." });
  }
  const usage = { used, limit: MONTHLY_LIMIT };
  if (req.method === "GET") return res.status(200).json({ usage });
  if (used >= MONTHLY_LIMIT) {
    return res.status(429).json({
      error: `Jatah ${MONTHLY_LIMIT} chat Konsultan AI bulan ini sudah habis. Jatah baru tersedia awal bulan depan.`,
      usage,
      limitReached: true,
    });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "Konsultan AI belum diaktifkan (GEMINI_API_KEY belum diisi di Vercel)." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const question = String(body.question || "").trim().slice(0, MAX_QUESTION);
  if (!question) return res.status(400).json({ error: "Pertanyaan kosong." });
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
  const models = [process.env.GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
    .filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: RULES }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  });

  let last = { status: 0, message: "" };
  const started = Date.now();
  for (let i = 0; i < models.length && i < 6; i++) {
    const model = models[i];
    const left = 50000 - (Date.now() - started);
    if (left < 5000) break;
    const t0 = Date.now();
    try {
      const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: AbortSignal.timeout(Math.min(20000, left)),
      });
      console.log("Gemini", model, g.status, `${Date.now() - t0}ms`);
      const data = await g.json().catch(() => ({}));
      if (g.ok) {
        const answer = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (!answer) return res.status(502).json({ error: "Konsultan AI tidak memberi jawaban. Coba ulangi pertanyaan." });
        // Hanya jawaban yang berhasil yang mengurangi jatah
        const newUsed = await addUsage(uid, idToken).catch(() => null);
        return res.status(200).json({ answer, model, usage: { used: newUsed ?? used + 1, limit: MONTHLY_LIMIT } });
      }
      last = { status: g.status, message: String(data.error?.message || "").slice(0, 300) };
      console.error("Gemini error", model, g.status, JSON.stringify(data).slice(0, 500));
      // 404 = model tidak tersedia, 429/500/503 = model penuh/bermasalah: coba model berikutnya.
      // Selain itu (mis. 400/403 key salah) model lain juga akan gagal, jadi berhenti.
      if (![404, 429, 500, 503].includes(g.status)) break;
      // Google sering menyarankan model pengganti: "... use models/xxx ..."
      const suggested = (last.message.match(/models\/([\w.-]+)/g) || [])
        .map((x) => x.replace("models/", ""))
        .filter((x) => x !== model && !models.includes(x));
      models.splice(i + 1, 0, ...suggested);
    } catch (e) {
      const timeout = e.name === "TimeoutError" || e.name === "AbortError";
      console.error("Gemini", model, timeout ? "timeout" : e, `${Date.now() - t0}ms`);
      last = { status: timeout ? 504 : 0, message: timeout ? `Model ${model} terlalu lama menjawab` : String(e.message || e).slice(0, 300) };
    }
  }

  const hint =
    last.status === 504
      ? "Gemini terlalu lama menjawab. Coba lagi sebentar lagi."
      : last.status === 429
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
