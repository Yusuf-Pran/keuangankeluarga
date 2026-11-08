// === Konsultan keuangan AI (Gemini lewat /api/konsultan) ===
const konsultanState = { history: [], busy: false };

function sumBy(list, fn) {
  return list.reduce((s, t) => s + (Number(t.nominal) || 0) * (fn(t) ? 1 : 0), 0);
}

// Ringkasan data yang dikirim ke AI: hanya angka & kategori, tanpa nama/email akun.
function buildFinanceSummary() {
  const data = window.appData || { transactions: [], categories: [], goals: [], recurring: [] };
  const ym = window.selectedMonth || todayISO().slice(0, 7);
  const inMonth = (m) => data.transactions.filter((t) => String(t.tanggal).startsWith(m));
  const monthTx = inMonth(ym);
  const income = sumBy(monthTx, (t) => t.jenis === "Pemasukan");
  const expense = sumBy(monthTx, (t) => t.jenis === "Pengeluaran");

  const kategori = data.categories
    .filter((c) => c.jenis === "Pengeluaran")
    .map((c) => ({
      nama: c.nama,
      terpakai: sumBy(monthTx, (t) => t.jenis === "Pengeluaran" && t.kategori === c.nama),
      budget: Number(c.budget) || 0,
    }))
    .filter((c) => c.terpakai || c.budget);

  const tren = [];
  for (let i = 3; i >= 1; i--) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const tx = inMonth(k);
    tren.push({ bulan: k, pemasukan: sumBy(tx, (t) => t.jenis === "Pemasukan"), pengeluaran: sumBy(tx, (t) => t.jenis === "Pengeluaran") });
  }

  const terbesar = monthTx
    .filter((t) => t.jenis === "Pengeluaran")
    .sort((a, b) => b.nominal - a.nominal)
    .slice(0, 5)
    .map((t) => ({ tanggal: t.tanggal, keterangan: String(t.nama || "").slice(0, 60), kategori: t.kategori, nominal: Number(t.nominal) }));

  const target = (data.goals || []).map((g) => ({
    nama: g.nama,
    target: Number(g.target) || 0,
    terkumpul: typeof goalTotal === "function" ? goalTotal(g) : 0,
    tenggat: g.tenggat || null,
  }));

  const rutin = (data.recurring || [])
    .filter((r) => r.aktif)
    .map((r) => ({ nama: r.nama, jenis: r.jenis, nominal: Number(r.nominal) }));

  return {
    bulan: ym,
    hari_ini: todayISO(),
    pemasukan_bulan_ini: income,
    pengeluaran_bulan_ini: expense,
    sisa_bulan_ini: income - expense,
    jumlah_transaksi_bulan_ini: monthTx.length,
    pengeluaran_per_kategori: kategori,
    tren_3_bulan_sebelumnya: tren,
    pengeluaran_terbesar_bulan_ini: terbesar,
    target_tabungan: target,
    transaksi_rutin_aktif: rutin,
  };
}

// Ubah teks jawaban (markdown sederhana) menjadi HTML yang aman
function renderAnswerHtml(text) {
  const lines = escapeHtml(text).split(/\r?\n/);
  let html = "";
  let inList = false;
  lines.forEach((raw) => {
    let line = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^#{1,6}\s*/, "");
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!inList) { html += '<ul class="list-disc pl-5 space-y-1 my-1">'; inList = true; }
      html += `<li>${bullet[1]}</li>`;
      return;
    }
    if (inList) { html += "</ul>"; inList = false; }
    html += line.trim() ? `<p class="my-1">${line}</p>` : "";
  });
  if (inList) html += "</ul>";
  return html;
}

function appendKonsultanBubble(role, html, extraClass = "") {
  const box = document.getElementById("konsultan-messages");
  const wrap = document.createElement("div");
  wrap.className = `flex ${role === "user" ? "justify-end" : "justify-start"} motion-slide-up`;
  const bubble = document.createElement("div");
  bubble.className =
    role === "user"
      ? "max-w-[85%] bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed"
      : `max-w-[90%] bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed ${extraClass}`;
  bubble.innerHTML = html;
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  document.getElementById("konsultan-empty")?.classList.add("hidden");
  return bubble;
}

async function askKonsultan(preset) {
  if (konsultanState.busy) return;
  const input = document.getElementById("konsultan-input");
  const question = String(preset || input.value || "").trim();
  if (!question) return input.focus();
  input.value = "";
  konsultanState.busy = true;
  document.getElementById("konsultan-send").disabled = true;

  appendKonsultanBubble("user", escapeHtml(question));
  const waiting = appendKonsultanBubble("model", '<span class="text-gray-400"><i class="fas fa-circle-notch fa-spin mr-2"></i>Konsultan sedang menganalisis…</span>');

  try {
    const token = window.sgAuth && (await window.sgAuth.getIdToken());
    const r = await fetch("/api/konsultan", {
      method: "POST",
      signal: AbortSignal.timeout ? AbortSignal.timeout(70000) : undefined,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
      body: JSON.stringify({ question, history: konsultanState.history, summary: buildFinanceSummary() }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.answer) throw new Error(data.error || "Konsultan AI belum bisa dihubungi.");
    waiting.innerHTML = renderAnswerHtml(data.answer);
    konsultanState.history.push({ role: "user", text: question }, { role: "model", text: data.answer });
    konsultanState.history = konsultanState.history.slice(-10);
  } catch (e) {
    const msg = e.name === "TimeoutError" || e.name === "AbortError" ? "Konsultan tidak menjawab dalam 70 detik. Coba lagi sebentar lagi." : e.message || "Terjadi kesalahan.";
    waiting.innerHTML = `<span class="text-rose-600 dark:text-rose-400"><i class="fas fa-exclamation-circle mr-1"></i>${escapeHtml(msg)}</span>`;
  } finally {
    konsultanState.busy = false;
    document.getElementById("konsultan-send").disabled = false;
    document.getElementById("konsultan-messages").scrollTop = 1e9;
  }
}

function resetKonsultan() {
  konsultanState.history = [];
  const box = document.getElementById("konsultan-messages");
  box.querySelectorAll(":scope > div:not(#konsultan-empty)").forEach((el) => el.remove());
  document.getElementById("konsultan-empty")?.classList.remove("hidden");
}
