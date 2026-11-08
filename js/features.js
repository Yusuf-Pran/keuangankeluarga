// === FASE 4: transaksi rutin, target tabungan, cadangan CSV, pengingat budget ===

function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addMonths(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthLabel(ym) {
  return new Date(ym + "-01T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}
function parseRupiahInput(v) {
  return parseInt(String(v || "").replace(/[^\d]/g, ""), 10) || 0;
}
function monthsBetween(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// ---------- Transaksi rutin ----------
window.addRecurringFromTransaction = function (tx) {
  const ym = tx.tanggal.slice(0, 7);
  const item = {
    id: generateId(),
    nama: tx.nama,
    jenis: tx.jenis,
    kategori: tx.kategori,
    nominal: tx.nominal,
    hari: Number(tx.tanggal.slice(8, 10)),
    mulai: ym,
    terakhir: ym, // bulan ini sudah dicatat oleh transaksi aslinya
    aktif: true,
  };
  tx.recurringId = item.id;
  window.appData.recurring.push(item);
};

// Catat transaksi rutin yang sudah jatuh tempo. Mengembalikan jumlah yang ditambahkan.
function postDueRecurring() {
  const data = window.appData;
  if (!data || !Array.isArray(data.recurring)) return 0;
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const dayToday = Number(today.slice(8, 10));
  let added = 0;

  data.recurring.forEach((r) => {
    if (!r.aktif) return;
    let ym = r.terakhir ? addMonths(r.terakhir, 1) : r.mulai;
    let guard = 0;
    while (ym <= thisMonth && guard++ < 24) {
      const [y, m] = ym.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const day = Math.min(r.hari, lastDay);
      if (ym === thisMonth && dayToday < day) break;
      const txId = `rec_${r.id}_${ym}`;
      if (!data.transactions.some((t) => t.id === txId)) {
        data.transactions.push({
          id: txId,
          tanggal: `${ym}-${pad2(day)}`,
          nama: r.nama,
          jenis: r.jenis,
          kategori: r.kategori,
          nominal: r.nominal,
          recurringId: r.id,
        });
        added++;
      }
      r.terakhir = ym;
      ym = addMonths(ym, 1);
    }
  });
  return added;
}

function nextRecurringDate(r) {
  const today = todayISO();
  let ym = r.terakhir ? addMonths(r.terakhir, 1) : r.mulai;
  if (ym < today.slice(0, 7)) ym = today.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const day = Math.min(r.hari, new Date(y, m, 0).getDate());
  return new Date(y, m - 1, day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function renderRecurringList() {
  const box = document.getElementById("recurring-list");
  if (!box) return;
  const items = window.appData.recurring || [];
  if (!items.length) {
    box.innerHTML = `<div class="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
      <i class="fas fa-rotate text-2xl mb-2 block opacity-60"></i>Belum ada transaksi rutin.</div>`;
    return;
  }
  box.innerHTML = items
    .map((r) => {
      const income = r.jenis === "Pemasukan";
      return `<div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700 ${r.aktif ? "" : "opacity-60"}">
        <div class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${income ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"}"><i class="fas fa-rotate"></i></div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-gray-800 dark:text-white truncate">${escapeHtml(r.nama)}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(r.kategori)} · tiap tgl ${r.hari} · ${r.aktif ? "berikutnya " + nextRecurringDate(r) : "dijeda"}</p>
        </div>
        <p class="num text-sm font-bold whitespace-nowrap ${income ? "text-emerald-600" : "text-rose-600"}">${income ? "+" : "-"}${formatRupiah(r.nominal)}</p>
        <button onclick="toggleRecurring('${safeId(r.id)}')" class="btn-press w-8 h-8 shrink-0 rounded-lg text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-gray-800" title="${r.aktif ? "Jeda" : "Lanjutkan"}" aria-label="${r.aktif ? "Jeda" : "Lanjutkan"}"><i class="fas ${r.aktif ? "fa-pause" : "fa-play"}"></i></button>
        <button onclick="deleteRecurring('${safeId(r.id)}')" class="btn-press w-8 h-8 shrink-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800" title="Hapus" aria-label="Hapus"><i class="fas fa-trash"></i></button>
      </div>`;
    })
    .join("");
}

function toggleRecurring(id) {
  const r = window.appData.recurring.find((x) => x.id === id);
  if (!r) return;
  r.aktif = !r.aktif;
  // Saat dilanjutkan, bulan-bulan yang terlewat tidak dicatat mundur
  if (r.aktif) {
    const lastWanted = addMonths(todayISO().slice(0, 7), -1);
    if (!r.terakhir || r.terakhir < lastWanted) r.terakhir = lastWanted;
    postDueRecurring();
  }
  saveData();
  showToast(r.aktif ? "Transaksi rutin dilanjutkan." : "Transaksi rutin dijeda.");
}

function deleteRecurring(id) {
  Modal.confirm(
    "Hapus transaksi rutin ini? Transaksi yang sudah tercatat tetap ada.",
    () => {
      window.appData.recurring = window.appData.recurring.filter((x) => x.id !== id);
      saveData();
      showToast("Transaksi rutin dihapus.");
    },
    true,
  );
}

// ---------- Target tabungan ----------
function openGoalModal(id) {
  const g = id ? window.appData.goals.find((x) => x.id === id) : null;
  document.getElementById("goal-modal-title").innerText = g ? "Ubah Target" : "Target Tabungan Baru";
  document.getElementById("goal-id").value = g ? g.id : "";
  document.getElementById("goal-name").value = g ? g.nama : "";
  const target = document.getElementById("goal-target");
  target.value = g ? String(g.target) : "";
  formatInputRupiah(target);
  document.getElementById("goal-deadline").value = g ? g.tenggat || "" : "";
  const modal = document.getElementById("goal-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => document.getElementById("goal-name").focus(), 50);
}

function closeGoalModal() {
  const modal = document.getElementById("goal-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function saveGoal(e) {
  e.preventDefault();
  const id = document.getElementById("goal-id").value;
  const nama = document.getElementById("goal-name").value.trim();
  const target = parseRupiahInput(document.getElementById("goal-target").value);
  const tenggat = document.getElementById("goal-deadline").value || "";
  if (!nama || target <= 0) {
    showToast("Isi nama dan jumlah target.", "warning");
    return;
  }
  if (id) {
    const g = window.appData.goals.find((x) => x.id === id);
    if (g) Object.assign(g, { nama, target, tenggat });
  } else {
    window.appData.goals.push({ id: generateId(), nama, target, tenggat, setoran: [] });
  }
  closeGoalModal();
  saveData();
  showToast(id ? "Target diperbarui." : "Target tabungan dibuat!");
}

function addGoalDeposit(id) {
  const g = window.appData.goals.find((x) => x.id === id);
  if (!g) return;
  Modal.show({
    title: `Setor ke "${g.nama}"`,
    message: "Masukkan jumlah yang ditabung. Isi angka minus untuk mengambil.",
    type: "prompt",
    placeholder: "Cth: 500000",
    confirmText: "Simpan",
    onConfirm: (val) => {
      const neg = /^\s*-/.test(val);
      const amount = parseRupiahInput(val) * (neg ? -1 : 1);
      if (!amount) return;
      g.setoran.push({ tanggal: todayISO(), nominal: amount });
      saveData();
      const total = goalTotal(g);
      if (amount > 0 && total >= g.target && total - amount < g.target)
        showToast(`Selamat! Target "${g.nama}" tercapai 🎉`);
      else showToast("Setoran dicatat.");
    },
  });
}

function deleteGoal(id) {
  Modal.confirm(
    "Hapus target tabungan ini?",
    () => {
      window.appData.goals = window.appData.goals.filter((x) => x.id !== id);
      saveData();
    },
    true,
  );
}

function goalTotal(g) {
  return (g.setoran || []).reduce((s, x) => s + (Number(x.nominal) || 0), 0);
}

function goalInfo(g) {
  const total = goalTotal(g);
  const sisa = Math.max(0, g.target - total);
  if (sisa === 0) return `<span class="text-emerald-600 dark:text-emerald-400 font-semibold">Target tercapai 🎉</span>`;
  const parts = [];
  const thisMonth = todayISO().slice(0, 7);
  if (g.tenggat) {
    const months = monthsBetween(thisMonth, g.tenggat) + 1;
    parts.push(
      months > 0
        ? `Perlu ${formatRupiah(Math.ceil(sisa / months))}/bulan sampai ${monthLabel(g.tenggat)}`
        : `Tenggat ${monthLabel(g.tenggat)} sudah lewat`,
    );
  }
  const deposits = (g.setoran || []).filter((x) => x.nominal > 0);
  if (deposits.length && total > 0) {
    const first = deposits.map((x) => x.tanggal.slice(0, 7)).sort()[0];
    const perMonth = total / (monthsBetween(first, thisMonth) + 1);
    if (perMonth > 0) {
      const est = addMonths(thisMonth, Math.ceil(sisa / perMonth));
      parts.push(`Perkiraan tercapai ${monthLabel(est)}`);
    }
  }
  if (!parts.length) parts.push("Mulai dengan setoran pertama");
  return parts.map(escapeHtml).join(" · ");
}

function renderGoals() {
  const box = document.getElementById("goal-list");
  if (!box) return;
  const goals = window.appData.goals || [];
  if (!goals.length) {
    box.innerHTML = `<button onclick="openGoalModal()" class="btn-press md:col-span-2 text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary hover:text-primary transition-colors">
      <i class="fas fa-bullseye text-2xl mb-2 block opacity-60"></i>Buat target pertama, misalnya dana darurat atau biaya sekolah.</button>`;
    return;
  }
  box.innerHTML = goals
    .map((g) => {
      const total = goalTotal(g);
      const pct = Math.max(0, Math.min(100, (total / g.target) * 100));
      const done = total >= g.target;
      return `<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700">
        <div class="flex items-start justify-between gap-2">
          <button onclick="openGoalModal('${safeId(g.id)}')" class="text-left min-w-0" title="Ubah target">
            <p class="text-sm font-bold text-gray-800 dark:text-white truncate">${escapeHtml(g.nama)}</p>
            <p class="num text-xs text-gray-500 dark:text-gray-400"><span class="font-bold text-gray-800 dark:text-gray-100">${formatRupiah(total)}</span> dari ${formatRupiah(g.target)}</p>
          </button>
          <div class="flex gap-1 shrink-0">
            <button onclick="addGoalDeposit('${safeId(g.id)}')" class="btn-press text-xs font-bold text-white bg-primary hover:bg-primaryDark px-3 py-1.5 rounded-lg"><i class="fas fa-plus mr-1"></i>Setor</button>
            <button onclick="deleteGoal('${safeId(g.id)}')" class="btn-press w-8 h-8 rounded-lg text-gray-400 hover:text-red-600" aria-label="Hapus target"><i class="fas fa-trash text-xs"></i></button>
          </div>
        </div>
        <div class="mt-3 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div class="budget-bar h-full rounded-full ${done ? "bg-emerald-500" : "bg-primary"}" style="width:0%" data-w="${pct.toFixed(1)}"></div>
        </div>
        <div class="flex justify-between gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>${goalInfo(g)}</span><span class="num font-semibold">${Math.floor(pct)}%</span>
        </div>
      </div>`;
    })
    .join("");
  requestAnimationFrame(() =>
    box.querySelectorAll("[data-w]").forEach((el) => (el.style.width = el.dataset.w + "%")),
  );
}

// ---------- Pengingat budget ----------
const NOTIF_KEY = "SAKUGENIUS_BUDGET_NOTIF";

function budgetUsage(kategori, ym, excludeId) {
  return window.appData.transactions
    .filter((t) => t.kategori === kategori && t.jenis === "Pengeluaran" && t.id !== excludeId && t.tanggal.startsWith(ym))
    .reduce((s, t) => s + t.nominal, 0);
}

function notifyBudget(message) {
  showToast(message, "warning");
  try {
    if (localStorage.getItem(NOTIF_KEY) === "on" && "Notification" in window && Notification.permission === "granted") {
      new Notification("SakuGenius", { body: message, icon: "Logo.png", tag: "sakugenius-budget" });
    }
  } catch (e) {
    /* beberapa browser HP hanya mengizinkan notifikasi lewat service worker */
  }
}

// Dipanggil saat menyimpan pengeluaran. Mengembalikan true bila sudah menampilkan peringatan.
window.checkBudgetAfterSave = function (kategori, ym, nominal, editId) {
  const cat = window.appData.categories.find((c) => c.nama === kategori && c.jenis === "Pengeluaran");
  if (!cat || !(Number(cat.budget) > 0)) return false;
  const before = budgetUsage(kategori, ym, editId);
  const after = before + nominal;
  const pctBefore = (before / cat.budget) * 100;
  const pct = Math.round((after / cat.budget) * 100);
  if (after > cat.budget && before <= cat.budget) {
    notifyBudget(`Budget "${kategori}" terlewati: ${formatRupiah(after)} dari ${formatRupiah(Number(cat.budget))} (${pct}%).`);
    return true;
  }
  if (pct >= 80 && pctBefore < 80 && after <= cat.budget) {
    notifyBudget(`Budget "${kategori}" sudah terpakai ${pct}%. Sisa ${formatRupiah(cat.budget - after)} untuk bulan ini.`);
    return true;
  }
  return false;
};

// Ringkasan budget saat aplikasi dibuka: paling banyak sekali sehari
let budgetSummaryShown = false;
function remindBudgetsOnOpen() {
  if (budgetSummaryShown) return;
  budgetSummaryShown = true;
  const dayKey = "SAKUGENIUS_BUDGET_REMINDED";
  try {
    if (localStorage.getItem(dayKey) === todayISO()) return;
    localStorage.setItem(dayKey, todayISO());
  } catch (e) {}
  const ym = todayISO().slice(0, 7);
  const near = window.appData.categories
    .filter((c) => c.jenis === "Pengeluaran" && Number(c.budget) > 0)
    .map((c) => ({ c, pct: (budgetUsage(c.nama, ym) / c.budget) * 100 }))
    .filter((x) => x.pct >= 80);
  if (!near.length) return;
  const text = near
    .map((x) => `${x.c.nama} ${Math.round(x.pct)}%`)
    .join(", ");
  notifyBudget(`Perhatikan budget bulan ini: ${text}.`);
}

function renderNotifSetting() {
  const toggle = document.getElementById("notif-toggle");
  const status = document.getElementById("notif-status");
  if (!toggle) return;
  const supported = "Notification" in window;
  toggle.disabled = !supported;
  toggle.checked = supported && localStorage.getItem(NOTIF_KEY) === "on" && Notification.permission === "granted";
  status.textContent = !supported
    ? "Browser ini tidak mendukung notifikasi. Peringatan tetap muncul di dalam aplikasi."
    : Notification.permission === "denied"
      ? "Notifikasi diblokir di pengaturan browser."
      : "Muncul saat aplikasi sedang dibuka.";
}

async function toggleBudgetNotifications(on) {
  if (!("Notification" in window)) return renderNotifSetting();
  if (on) {
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    localStorage.setItem(NOTIF_KEY, perm === "granted" ? "on" : "off");
    if (perm === "granted") showToast("Notifikasi pengingat budget aktif.");
  } else {
    localStorage.setItem(NOTIF_KEY, "off");
  }
  renderNotifSetting();
}

// ---------- Cadangan CSV ----------
function csvEscape(v) {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV() {
  const txs = [...window.appData.transactions].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  if (!txs.length) {
    showToast("Belum ada transaksi untuk diekspor.", "warning");
    return;
  }
  const rows = [["Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal"]].concat(
    txs.map((t) => [t.tanggal, t.jenis, t.kategori, t.nama, t.nominal]),
  );
  // Titik koma: dibuka rapi oleh Excel berbahasa Indonesia
  const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `SakuGenius_Transaksi_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast(`${txs.length} transaksi diekspor.`);
}

function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delim = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function parseCsvDate(v) {
  v = String(v || "").trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); // 31/12/2026
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return null;
}

function parseCsvAmount(v) {
  let s = String(v || "").replace(/rp/i, "").replace(/\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return Math.round(Math.abs(parseFloat(s))) || 0;
}

function importCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(String(reader.result || ""));
    if (rows.length < 2) {
      showToast("File CSV kosong atau tidak terbaca.", "error");
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const iDate = col(["tanggal", "date"]);
    const iType = col(["jenis", "tipe", "type"]);
    const iCat = col(["kategori", "category"]);
    const iName = col(["keterangan", "nama", "deskripsi", "description"]);
    const iAmt = col(["nominal", "jumlah", "amount"]);
    if (iDate < 0 || iAmt < 0) {
      showToast("Kolom Tanggal dan Nominal tidak ditemukan di file.", "error");
      return;
    }

    const data = window.appData;
    const key = (t) => [t.tanggal, t.jenis, t.kategori, t.nama, t.nominal].join("|").toLowerCase();
    const existing = new Set(data.transactions.map(key));
    let added = 0, skipped = 0, invalid = 0, newCats = 0;

    rows.slice(1).forEach((r) => {
      const tanggal = parseCsvDate(r[iDate]);
      const nominal = parseCsvAmount(r[iAmt]);
      if (!tanggal || !nominal) { invalid++; return; }
      const rawType = iType >= 0 ? String(r[iType] || "").toLowerCase() : "";
      const jenis = /masuk|income|kredit|cr/.test(rawType) ? "Pemasukan" : "Pengeluaran";
      const kategori = (iCat >= 0 && String(r[iCat] || "").trim()) || "Lain-lain";
      const nama = (iName >= 0 && String(r[iName] || "").trim()) || kategori;
      const tx = { id: generateId(), tanggal, jenis, kategori, nama, nominal };
      if (existing.has(key(tx))) { skipped++; return; }
      if (!data.categories.some((c) => c.nama === kategori && c.jenis === jenis)) {
        data.categories.push({ id: generateId(), jenis, nama: kategori, budget: 0 });
        newCats++;
      }
      data.transactions.push(tx);
      existing.add(key(tx));
      added++;
    });

    if (added) saveData();
    const notes = [];
    if (skipped) notes.push(`${skipped} sudah ada`);
    if (invalid) notes.push(`${invalid} baris tidak terbaca`);
    if (newCats) notes.push(`${newCats} kategori baru`);
    showToast(
      `${added} transaksi dimasukkan${notes.length ? " (" + notes.join(", ") + ")" : ""}.`,
      added ? "success" : "warning",
    );
  };
  reader.onerror = () => showToast("Gagal membaca file.", "error");
  reader.readAsText(file);
}

// ---------- Penghubung ----------
window.renderExtraFeatures = function () {
  syncResetMonth();
  renderRecurringList();
  renderGoals();
  renderNotifSetting();
};

// Dipanggil setelah data cloud pertama kali diterima (supaya tidak menimpa data terbaru)
window.runAutoTasks = function () {
  const added = postDueRecurring();
  if (added) {
    saveData();
    showToast(`${added} transaksi rutin dicatat otomatis.`);
  }
  remindBudgetsOnOpen();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeGoalModal();
});

// ===== Reset data: hapus transaksi sekaligus =====
function syncResetMonth() {
  const el = document.getElementById("reset-month");
  if (el && !el.value) el.value = todayISO().slice(0, 7);
}

function resetMonthTransactions() {
  syncResetMonth();
  const ym = document.getElementById("reset-month").value;
  if (!ym) return;
  const label = new Date(ym + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const count = window.appData.transactions.filter((t) => String(t.tanggal).startsWith(ym)).length;
  if (!count) return showToast(`Tidak ada transaksi di ${label}.`);
  Modal.confirm(
    `Hapus ${count} transaksi di ${label}? Data yang dihapus tidak bisa dikembalikan.`,
    () => {
      window.appData.transactions = window.appData.transactions.filter((t) => !String(t.tanggal).startsWith(ym));
      saveData();
      showToast(`${count} transaksi ${label} dihapus.`);
    },
    true,
  );
}

function resetAllTransactions() {
  const count = window.appData.transactions.length;
  if (!count) return showToast("Belum ada transaksi.");
  Modal.prompt(
    `Hapus SEMUA ${count} transaksi? Data yang dihapus tidak bisa dikembalikan. Ketik HAPUS untuk melanjutkan.`,
    "Ketik HAPUS",
    (val) => {
      if (String(val).toUpperCase() !== "HAPUS") return showToast("Dibatalkan. Ketik HAPUS untuk menghapus semua.");
      window.appData.transactions = [];
      saveData();
      showToast("Semua transaksi dihapus.");
    },
  );
}
