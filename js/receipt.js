// === FOTO STRUK -> ISI FORM ===
// Teks di foto dibaca dengan Tesseract.js (OCR) langsung di perangkat, tanpa AI dan
// tanpa server. Lalu dicari baris TOTAL untuk nominal, nama toko, dan tanggal struk.

const OCR_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const OCR_OPTIONS = {
  workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
  corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
  langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/ind@1.0.0/4.0.0_best_int",
};
let ocrWorkerPromise = null;
let ocrBusy = false;

function loadOcrLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OCR_SRC;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error("Gagal memuat pembaca struk"));
    document.head.appendChild(s);
  });
}

function getOcrWorker(onProgress) {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = loadOcrLibrary()
      .then((T) =>
        T.createWorker("ind", 1, {
          ...OCR_OPTIONS,
          logger: (m) => window._ocrProgress && window._ocrProgress(m),
        }),
      )
      .catch((e) => {
        ocrWorkerPromise = null;
        throw e;
      });
  }
  window._ocrProgress = onProgress;
  return ocrWorkerPromise;
}

// Perkecil, abu-abukan, dan pertajam kontras supaya teks struk lebih mudah dibaca
function prepareReceiptImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1600;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      let min = 255, max = 0;
      for (let i = 0; i < px.length; i += 4) {
        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        px[i] = g;
        if (g < min) min = g;
        if (g > max) max = g;
      }
      const range = Math.max(1, max - min);
      for (let i = 0; i < px.length; i += 4) {
        const v = ((px[i] - min) / range) * 255;
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak bisa dibuka"));
    };
    img.src = url;
  });
}

// ---------- Mengurai teks struk ----------
const TOTAL_KEYWORDS = [
  [/GRAND\s*TOTAL|TOTAL\s*(BELANJA|BAYAR|PEMBAYARAN|HARGA|TAGIHAN|AKHIR)|JUMLAH\s*(BAYAR|TAGIHAN|TOTAL)|TOTAL\s*RP|NETTO/, 3],
  [/\bTOTAL\b|\bJUMLAH\b|\bTAGIHAN\b|\bAMOUNT\s*DUE\b/, 2],
];
const NOT_TOTAL = /SUB\s*-?\s*TOTAL|TOTAL\s*(ITEM|QTY|JML|DISK|HEMAT|PPN|PAJAK|POTONGAN|KUANTITAS|BARANG)|KEMBALI|CHANGE|DPP|\bPPN\b|PAJAK|DISKON|DISC|HEMAT|POIN|POINT|SAVING|VOUCHER/;
const PAID_LINE = /TUNAI|CASH|BAYAR\s*TUNAI|\bDEBIT\b|KARTU|QRIS|OVO|GOPAY|DANA\b|SHOPEEPAY|E-?MONEY|FLAZZ/;
const CHANGE_LINE = /KEMBALI|KEMBALIAN|CHANGE/;

// Rapikan salah baca OCR di dalam angka: O->0, l/I->1, S->5, B->8
function fixDigits(line) {
  return line.replace(/[0-9OoIlSB.,]{4,}/g, (tok) =>
    /\d/.test(tok) ? tok.replace(/[Oo]/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5").replace(/B/g, "8") : tok,
  );
}

function amountsInLine(line) {
  const out = [];
  const re = /(?:RP\.?\s*)?(\d{1,3}(?:[.,]\s?\d{3})+|\d{4,9})(?:[.,]\d{2}(?!\d))?/gi;
  let m;
  while ((m = re.exec(line))) {
    const n = Number(m[1].replace(/[.,\s]/g, ""));
    if (n >= 100 && n < 1e10) out.push(n);
  }
  return out;
}

function parseReceiptText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => fixDigits(l.trim()))
    .filter(Boolean);
  const upper = lines.map((l) => l.toUpperCase());

  // 1. Baris TOTAL (bukan subtotal/diskon/kembalian)
  let best = null;
  upper.forEach((u, i) => {
    if (NOT_TOTAL.test(u)) return;
    for (const [re, score] of TOTAL_KEYWORDS) {
      if (!re.test(u)) continue;
      let nums = amountsInLine(u);
      if (!nums.length && upper[i + 1] && !NOT_TOTAL.test(upper[i + 1])) nums = amountsInLine(upper[i + 1]);
      if (nums.length) {
        const value = nums[nums.length - 1];
        // Skor sama: ambil yang paling bawah (total akhir biasanya setelah diskon)
        if (!best || score > best.score || (score === best.score && i >= best.line))
          best = { value, score, line: i };
      }
      break;
    }
  });

  // 2. Cadangan: TUNAI - KEMBALI
  const findLine = (re) => {
    const i = upper.findIndex((u) => re.test(u) && amountsInLine(u).length);
    return i >= 0 ? amountsInLine(upper[i]).pop() : null;
  };
  const paid = findLine(PAID_LINE);
  const change = findLine(CHANGE_LINE);
  if (!best && paid && change != null && paid > change) best = { value: paid - change, score: 1 };

  // Kandidat lain untuk dipilih pengguna
  const all = [];
  upper.forEach((u) => {
    if (CHANGE_LINE.test(u) || /NPWP|TELP|TEL\b|HP\b|NO\.|KASIR|REF|TRX|\d{2}:\d{2}/.test(u)) return;
    amountsInLine(u).forEach((n) => all.push(n));
  });
  const uniq = [...new Set(all)].sort((a, b) => b - a);
  if (!best && uniq.length) best = { value: uniq[0], score: 0 };
  const total = best ? best.value : 0;
  const alternatives = uniq.filter((n) => n !== total).slice(0, 3);

  // Nama toko: baris teks pertama yang berisi huruf (bukan alamat/angka/tanggal)
  const SKIP_NAME = /^(JL|JALAN|TELP|TEL|NPWP|NO\.?|TANGGAL|TGL|KASIR|STRUK|NOTA|WWW|HTTP|\d)/;
  let toko = "";
  for (const l of lines.slice(0, 6)) {
    const clean = l.replace(/[^A-Za-z0-9 &'.-]/g, " ").replace(/\s+/g, " ").trim();
    const letters = (clean.match(/[A-Za-z]/g) || []).length;
    if (letters >= 3 && letters / clean.length > 0.5 && !SKIP_NAME.test(clean.toUpperCase())) {
      toko = clean;
      break;
    }
  }

  // Tanggal struk: dd/mm/yy(yy), dd-mm-yyyy, atau yyyy-mm-dd
  let tanggal = null;
  const dm = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/) || null;
  const ym = text.match(/\b(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/);
  let y, mo, d;
  if (ym) [y, mo, d] = [Number(ym[1]), Number(ym[2]), Number(ym[3])];
  else if (dm) {
    [d, mo, y] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
    if (y < 100) y += 2000;
  }
  if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
    const dt = new Date(y, mo - 1, d);
    const ageDays = (Date.now() - dt.getTime()) / 864e5;
    if (ageDays >= -1 && ageDays <= 90)
      tanggal = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return { total, alternatives, toko, tanggal };
}

// ---------- Alur di layar ----------
function setReceiptStatus(text, pct) {
  document.getElementById("receipt-status-text").textContent = text;
  if (pct != null) document.getElementById("receipt-progress").style.width = Math.round(pct) + "%";
}

function setReceiptAmount(n) {
  const amount = document.getElementById("input-amount");
  amount.value = String(n);
  formatInputRupiah(amount);
  flashField("input-amount");
}

async function scanReceipt(file) {
  if (!file || ocrBusy) return;
  if (!/^image\//.test(file.type)) {
    showToast("Pilih file foto struk (JPG/PNG).", "warning");
    return;
  }
  ocrBusy = true;
  const box = document.getElementById("receipt-status");
  const thumb = document.getElementById("receipt-thumb");
  const alt = document.getElementById("receipt-alt");
  const btn = document.getElementById("receipt-btn");
  alt.classList.add("hidden");
  alt.innerHTML = "";
  if (thumb.src) URL.revokeObjectURL(thumb.src);
  thumb.src = URL.createObjectURL(file);
  box.classList.remove("hidden");
  btn.disabled = true;
  btn.querySelector("i").className = "fas fa-spinner fa-spin text-lg";
  setReceiptStatus("Menyiapkan pembaca struk...", 5);

  try {
    const canvas = await prepareReceiptImage(file);
    const worker = await getOcrWorker((m) => {
      if (m.status === "recognizing text") setReceiptStatus("Membaca struk...", 30 + m.progress * 70);
      else if (/load|initializ/.test(m.status)) setReceiptStatus("Menyiapkan pembaca struk (sekali saja)...", 5 + (m.progress || 0) * 25);
    });
    setReceiptStatus("Membaca struk...", 30);
    const { data } = await worker.recognize(canvas);
    const r = parseReceiptText(data.text);

    // Isi form: pengeluaran, nama toko, tanggal, nominal
    const typeSel = document.getElementById("input-type");
    if (typeSel.value !== "Pengeluaran") {
      typeSel.value = "Pengeluaran";
      updateCategoryDropdown();
    }
    const name = document.getElementById("input-name");
    if (!name.value.trim()) name.value = r.toko ? `Belanja di ${r.toko}` : "Belanja";
    flashField("input-name");
    if (r.tanggal) {
      document.getElementById("input-date").value = r.tanggal;
      flashField("input-date");
    }

    if (r.total) {
      setReceiptAmount(r.total);
      setReceiptStatus(`Total terbaca: ${formatRupiah(r.total)}. Periksa lagi sebelum simpan.`, 100);
      if (r.alternatives.length) {
        alt.innerHTML =
          '<span class="text-[11px] text-gray-500 dark:text-gray-400 self-center">Bukan? Pilih:</span>' +
          r.alternatives
            .map((n) => `<button type="button" class="voice-chip btn-press" onclick="setReceiptAmount(${n})">${formatRupiah(n)}</button>`)
            .join("");
        alt.classList.remove("hidden");
      }
    } else {
      setReceiptStatus("Total belum terbaca. Isi nominal manual, atau foto ulang lebih dekat dan terang.", 100);
    }

    const hintText = `${r.toko} belanja ${data.text}`.toLowerCase();
    let hint = null;
    for (const [re, hints] of CATEGORY_HINTS) {
      if (re.test(hintText)) { hint = hints; break; }
    }
    showCategoryChips(suggestCategory(hint || ["belanja", "kebutuhan", "makan"], "Pengeluaran"), "Pengeluaran");
  } catch (e) {
    console.error(e);
    setReceiptStatus(
      navigator.onLine === false
        ? "Butuh internet untuk pertama kali memakai fitur ini."
        : "Gagal membaca struk. Coba foto ulang.",
      0,
    );
  } finally {
    ocrBusy = false;
    btn.disabled = false;
    btn.querySelector("i").className = "fas fa-receipt text-lg";
  }
}

// Sembunyikan status struk saat form dikosongkan
(function hookResetForReceipt() {
  const original = window.resetForm;
  if (typeof original !== "function") return;
  window.resetForm = function () {
    original.apply(this, arguments);
    const box = document.getElementById("receipt-status");
    if (box) box.classList.add("hidden");
  };
})();
