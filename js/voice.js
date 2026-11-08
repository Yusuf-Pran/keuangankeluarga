// === CATAT PAKAI SUARA ===
// Ucapan diubah jadi teks oleh browser (Web Speech API), lalu kalimatnya
// diurai di perangkat: nama, nominal, jenis, dan tanggal langsung mengisi form.
// Pengguna tinggal memilih kategori.

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceRec = null;
let voiceListening = false;

const NUM_WORDS = {
  nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  sepuluh: 10, sebelas: 11, seratus: 100,
};
const MULTIPLIERS = { ribu: 1e3, juta: 1e6, miliar: 1e9, milyar: 1e9 };

const INCOME_WORDS =
  /\b(gaji|gajian|bonus|thr|terima|terima uang|dapat|dapet|pemasukan|masuk|komisi|honor|jual|penjualan|dividen|refund|cashback|hadiah|transferan)\b/;

const FILLER_WORDS = new Set([
  "rp", "rupiah", "seharga", "sebesar", "harganya", "habis", "total", "sebanyak",
  "pengeluaran", "pemasukan", "catat", "tolong", "untuk", "buat",
  "kemarin", "kemaren", "tadi", "barusan", "senilai",
]);

// Kata kunci -> potongan nama kategori (dicocokkan dengan nama kategori milik pengguna)
const CATEGORY_HINTS = [
  [/\b(makan|minum|kopi|jajan|sarapan|siang|malam|nasi|bakso|mie|resto|warteg|gofood|grabfood|snack|teh|boba)\b/, ["makan", "minum", "kuliner"]],
  [/\b(bensin|pertalite|pertamax|solar|parkir|ojek|ojol|gojek|grab|tol|kereta|krl|bus|busway|angkot|taksi|transport|servis motor|servis mobil)\b/, ["transport", "bensin", "kendaraan"]],
  [/\b(listrik|token|pln|pdam|air|internet|wifi|indihome|pulsa|kuota|tagihan|cicilan|iuran|bpjs|asuransi|sewa|kos|kontrakan)\b/, ["tagihan", "utilitas", "cicilan"]],
  [/\b(obat|dokter|apotek|klinik|rumah sakit|vitamin|periksa)\b/, ["kesehatan", "obat"]],
  [/\b(nonton|bioskop|film|game|liburan|wisata|jalan|jalan-jalan|konser|netflix|spotify|hiburan)\b/, ["hiburan", "rekreasi", "jalan"]],
  [/\b(belanja|beras|sayur|pasar|supermarket|indomaret|alfamart|sabun|sampo|minyak|gula|telur|bulanan|kebutuhan)\b/, ["belanja", "kebutuhan", "pokok"]],
  [/\b(sekolah|spp|buku|les|kursus|kuliah)\b/, ["pendidikan", "sekolah"]],
  [/\b(sedekah|zakat|infak|infaq|donasi|sumbangan|kondangan)\b/, ["sosial", "sedekah", "zakat", "donasi"]],
  [/\b(nabung|tabung|tabungan|investasi|reksadana|saham|emas)\b/, ["nabung", "tabung", "investasi"]],
  [/\b(gaji|gajian)\b/, ["gaji"]],
  [/\b(bonus|thr)\b/, ["bonus", "thr"]],
  [/\b(jual|penjualan|usaha|dagang)\b/, ["usaha", "jual", "bisnis"]],
];

function isNumberToken(tok) {
  return /^\d+([.,]\d+)*$/.test(tok) || tok in NUM_WORDS || tok in MULTIPLIERS ||
    ["puluh", "belas", "ratus", "setengah", "seribu", "sejuta"].includes(tok);
}

function parseDigits(tok) {
  // 20.000 / 1.250.000 = pemisah ribuan; 1,5 / 1.5 = desimal
  if (/^\d{1,3}(\.\d{3})+$/.test(tok)) return Number(tok.replace(/\./g, ""));
  return Number(tok.replace(",", "."));
}

// Ubah deretan kata/angka menjadi nilai, contoh: ["dua","ratus","lima","puluh","ribu"] -> 250000
function wordsToNumber(tokens) {
  let total = 0, cur = 0, last = 0, any = false;
  for (const tok of tokens) {
    if (/^\d/.test(tok)) { cur += parseDigits(tok); last = parseDigits(tok); any = true; }
    else if (tok in NUM_WORDS) { cur += NUM_WORDS[tok]; last = NUM_WORDS[tok]; any = true; }
    else if (tok === "setengah") { cur += 0.5; last = 0.5; any = true; }
    else if (tok === "puluh") { cur += last * 9; last *= 10; }
    else if (tok === "belas") { cur += 10; last += 10; }
    else if (tok === "ratus") { cur += last * 99; last *= 100; }
    else if (tok === "seribu") { total += 1e3; cur = 0; last = 0; any = true; }
    else if (tok === "sejuta") { total += 1e6; cur = 0; last = 0; any = true; }
    else if (tok in MULTIPLIERS) {
      // "1,5 juta 200 ribu": tiap pengali menutup satu kelompok
      total += (cur || 1) * MULTIPLIERS[tok];
      cur = 0; last = 0; any = true;
    }
  }
  return any ? Math.round(total + cur) : 0;
}

function parseVoiceText(raw) {
  let text = String(raw || "").toLowerCase().trim();
  const result = { nama: "", nominal: 0, jenis: "Pengeluaran", tanggal: null, kategoriHint: null };
  if (!text) return result;

  // Rapikan penulisan nominal: rp20.000, 20rb, 20k, 1.5jt, 2jt
  text = text
    .replace(/rp\.?\s*/g, " rp ")
    .replace(/(\d)\s*(rb|ribu|k)\b/g, "$1 ribu")
    .replace(/(\d)\s*(jt|juta)\b/g, "$1 juta")
    .replace(/\brb\b/g, "ribu")
    .replace(/\bjt\b/g, "juta")
    .replace(/[!?;:]/g, " ")
    .replace(/\bhari ini\b/g, " ");

  // Tanggal
  const today = new Date();
  const toISO = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  if (/\bkemarin lusa\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() - 2); result.tanggal = toISO(d);
    text = text.replace(/\bkemarin lusa\b/, " ");
  } else if (/\bkemar(i|e)n\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() - 1); result.tanggal = toISO(d);
  }

  if (INCOME_WORDS.test(text)) result.jenis = "Pemasukan";

  // Cari deretan angka terpanjang
  const tokens = text.split(/\s+/).filter(Boolean).map((t) => t.replace(/^[,.]+|[,.]+$/g, ""));
  let best = { start: -1, end: -1, value: 0 };
  for (let i = 0; i < tokens.length; i++) {
    if (!isNumberToken(tokens[i]) || tokens[i] === "se") continue;
    let j = i;
    while (j < tokens.length && isNumberToken(tokens[j])) j++;
    const value = wordsToNumber(tokens.slice(i, j));
    if (value > best.value) best = { start: i, end: j, value };
    i = j - 1;
  }
  result.nominal = best.value;

  // Nama = sisa kata tanpa nominal dan kata pengisi
  const nameTokens = tokens.filter(
    (t, idx) => (idx < best.start || idx >= best.end) && t && !FILLER_WORDS.has(t),
  );
  const nama = nameTokens.join(" ").replace(/\s+/g, " ").trim();
  result.nama = nama ? nama.charAt(0).toUpperCase() + nama.slice(1) : "";

  for (const [re, hints] of CATEGORY_HINTS) {
    if (re.test(text)) { result.kategoriHint = hints; break; }
  }
  return result;
}

function suggestCategory(hints, jenis) {
  const cats = window.appData.categories.filter((c) => c.jenis === jenis);
  if (hints) {
    for (const h of hints) {
      const found = cats.find((c) => c.nama.toLowerCase().includes(h));
      if (found) return found.nama;
    }
  }
  return null;
}

function applyVoiceText(text) {
  const parsed = parseVoiceText(text);
  if (!parsed.nominal && !parsed.nama) {
    showToast('Belum menangkap isinya. Coba lagi, misalnya "makan siang 20 ribu".', "warning");
    return;
  }

  const typeSel = document.getElementById("input-type");
  if (typeSel.value !== parsed.jenis) {
    typeSel.value = parsed.jenis;
    updateCategoryDropdown();
  }
  if (parsed.nama) document.getElementById("input-name").value = parsed.nama;
  if (parsed.nominal) {
    const amount = document.getElementById("input-amount");
    amount.value = String(parsed.nominal);
    formatInputRupiah(amount);
  }
  if (parsed.tanggal) document.getElementById("input-date").value = parsed.tanggal;

  ["input-name", "input-amount", "input-type"].forEach((id) => flashField(id));
  if (!parsed.nominal) showToast("Nominal belum terdengar, isi manual ya.", "warning");

  showCategoryChips(suggestCategory(parsed.kategoriHint, parsed.jenis), parsed.jenis);
}

function flashField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("voice-filled");
  void el.offsetWidth;
  el.classList.add("voice-filled");
}

function showCategoryChips(suggested, jenis) {
  const box = document.getElementById("voice-category");
  const chips = document.getElementById("voice-category-chips");
  const select = document.getElementById("input-category");
  const cats = window.appData.categories.filter((c) => c.jenis === jenis);
  chips.innerHTML = "";
  if (suggested) select.value = suggested;

  cats.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "voice-chip btn-press";
    b.textContent = c.nama;
    if (c.nama === suggested) {
      b.classList.add("is-active");
      b.title = "Saran otomatis, ketuk kategori lain untuk mengganti";
    }
    b.onclick = () => {
      select.value = c.nama;
      chips.querySelectorAll(".voice-chip").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      flashField("input-category");
    };
    chips.appendChild(b);
  });
  box.classList.remove("hidden");
  setVoiceHint(
    suggested
      ? `Form sudah terisi. Kategori disarankan: ${suggested}. Ketuk kategori lain jika perlu, lalu Simpan.`
      : "Form sudah terisi. Pilih kategorinya, lalu Simpan.",
  );
}

function hideCategoryChips() {
  const box = document.getElementById("voice-category");
  if (box) box.classList.add("hidden");
  const t = document.getElementById("voice-text");
  if (t) t.value = "";
  setVoiceHint('Tekan mikrofon lalu ucapkan, misalnya "makan siang 20 ribu".');
}

function setVoiceHint(msg) {
  const el = document.getElementById("voice-hint");
  if (el) el.textContent = msg;
}

function setListening(on) {
  voiceListening = on;
  const btn = document.getElementById("voice-btn");
  if (!btn) return;
  btn.classList.toggle("is-listening", on);
  btn.querySelector("i").className = on ? "fas fa-stop text-lg" : "fas fa-microphone text-lg";
  btn.setAttribute("aria-label", on ? "Berhenti merekam" : "Catat pakai suara");
}

function toggleVoiceInput() {
  if (!SpeechRec) {
    setVoiceHint("Browser ini belum mendukung input suara. Ketik kalimatnya di kolom bawah, atau buka di Google Chrome.");
    document.getElementById("voice-text").focus();
    return;
  }
  if (voiceListening && voiceRec) {
    voiceRec.stop();
    return;
  }

  voiceRec = new SpeechRec();
  voiceRec.lang = "id-ID";
  voiceRec.interimResults = true;
  voiceRec.maxAlternatives = 1;
  const field = document.getElementById("voice-text");
  let finalText = "";

  voiceRec.onstart = () => {
    setListening(true);
    setVoiceHint("Mendengarkan... ucapkan pengeluaran Anda.");
    field.value = "";
  };
  voiceRec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    field.value = (finalText + interim).trim();
  };
  voiceRec.onerror = (e) => {
    const msg = {
      "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser.",
      "service-not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser.",
      "no-speech": "Tidak ada suara terdengar. Coba lagi.",
      network: "Input suara butuh koneksi internet.",
    }[e.error];
    if (msg) setVoiceHint(msg);
  };
  voiceRec.onend = () => {
    setListening(false);
    const text = field.value.trim();
    if (text) applyVoiceText(text);
  };
  try {
    voiceRec.start();
  } catch (err) {
    setListening(false);
  }
}

// Sembunyikan pilihan kategori setelah form dikosongkan / disimpan
(function hookResetForm() {
  const original = window.resetForm;
  if (typeof original !== "function") return;
  window.resetForm = function () {
    original.apply(this, arguments);
    hideCategoryChips();
  };
})();
