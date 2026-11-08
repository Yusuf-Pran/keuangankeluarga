const Modal = {
  show: function (options) {
    document.getElementById("modal-title").innerText =
      options.title || "Informasi";
    document.getElementById("modal-message").innerText =
      options.message || "";
    const inputContainer = document.getElementById(
      "modal-input-container",
    );
    const inputEl = document.getElementById("modal-input");
    if (options.type === "prompt") {
      inputContainer.classList.remove("hidden");
      inputEl.value = "";
      inputEl.placeholder = options.placeholder || "Ketik di sini...";
      setTimeout(() => inputEl.focus(), 100);
    } else {
      inputContainer.classList.add("hidden");
    }
    const btnContainer = document.getElementById("modal-buttons");
    btnContainer.innerHTML = "";
    if (options.type === "alert" || !options.type) {
      const btn = document.createElement("button");
      btn.className =
        "bg-primary text-white font-bold py-2 px-8 rounded-xl hover:bg-primaryDark transition-colors w-full";
      btn.innerText = "OK";
      btn.onclick = () => {
        this.hide();
        if (options.onConfirm) options.onConfirm();
      };
      btnContainer.appendChild(btn);
    } else if (options.type === "confirm" || options.type === "prompt") {
      const btnCancel = document.createElement("button");
      btnCancel.className =
        "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors w-1/2";
      btnCancel.innerText = "Batal";
      btnCancel.onclick = () => {
        this.hide();
        if (options.onCancel) options.onCancel();
      };
      btnContainer.appendChild(btnCancel);
      const btnOk = document.createElement("button");
      btnOk.className =
        (options.danger
          ? "bg-red-600 hover:bg-red-700"
          : "bg-primary hover:bg-primaryDark") +
        " text-white font-bold py-2 px-4 rounded-xl transition-colors w-1/2";
      btnOk.innerText = options.confirmText || "OK";
      btnOk.onclick = () => {
        this.hide();
        if (options.type === "prompt") {
          if (options.onConfirm) options.onConfirm(inputEl.value.trim());
        } else {
          if (options.onConfirm) options.onConfirm();
        }
      };
      btnContainer.appendChild(btnOk);
    }
    const modalEl = document.getElementById("custom-modal");
    modalEl.classList.remove("hidden");
    modalEl.classList.add("flex");
    setTimeout(() => modalEl.classList.add("opacity-100"), 10);
  },
  hide: function () {
    const modalEl = document.getElementById("custom-modal");
    modalEl.classList.remove("opacity-100");
    setTimeout(() => {
      modalEl.classList.add("hidden");
      modalEl.classList.remove("flex");
    }, 300);
  },
  alert: function (msg, onOk) {
    this.show({ type: "alert", message: msg, onConfirm: onOk });
  },
  confirm: function (msg, onOk, danger = false) {
    this.show({
      type: "confirm",
      message: msg,
      confirmText: "Ya",
      danger: danger,
      onConfirm: onOk,
    });
  },
  prompt: function (msg, placeholder, onOk) {
    this.show({
      type: "prompt",
      message: msg,
      placeholder: placeholder,
      danger: true,
      confirmText: "Proses",
      onConfirm: onOk,
    });
  },
};

const DB_KEY = "SAKUGENIUS_DATA";
const defaultData = {
  transactions: [],
  categories: [
    {
      id: "c1",
      jenis: "Pengeluaran",
      nama: "Makanan & Minuman",
      budget: 1500000,
    },
    {
      id: "c2",
      jenis: "Pengeluaran",
      nama: "Transportasi",
      budget: 500000,
    },
    {
      id: "c3",
      jenis: "Pengeluaran",
      nama: "Tagihan & Utilitas",
      budget: 1000000,
    },
    { id: "c4", jenis: "Pemasukan", nama: "Gaji", budget: 0 },
    { id: "c5", jenis: "Pemasukan", nama: "Bonus", budget: 0 },
  ],
};

// Data lokal disimpan per akun: SAKUGENIUS_DATA_<uid>.
// Sebelum login, appData berisi data awal saja.
let currentDataKey = null;
window.appData = JSON.parse(JSON.stringify(defaultData));

// Pastikan semua bagian data ada (data lama belum punya recurring/goals)
function ensureDataShape(data) {
  const d = data && typeof data === "object" ? data : {};
  if (!Array.isArray(d.transactions)) d.transactions = [];
  if (!Array.isArray(d.categories)) d.categories = [];
  if (!Array.isArray(d.recurring)) d.recurring = [];
  if (!Array.isArray(d.goals)) d.goals = [];
  return d;
}

function readLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    console.error("Data lokal rusak, diabaikan:", e);
    return null;
  }
}

// Dipanggil firebase-sync.js saat akun yang disetujui masuk.
// Mengembalikan data lokal milik akun ini (termasuk data lama sebelum ada akun).
window.loadLocalDataForUser = function (uid, email) {
  currentDataKey = `${DB_KEY}_${uid}`;
  let data = readLocalData(currentDataKey);
  if (!data) {
    // Data lama (versi lisensi) hanya diambil jika email-nya sama
    const legacyEmail = (localStorage.getItem("SAKUGENIUS_USER_EMAIL") || "").toLowerCase();
    if (legacyEmail && legacyEmail === String(email || "").toLowerCase()) {
      data = readLocalData(DB_KEY);
    }
  }
  window.appData = ensureDataShape(data || JSON.parse(JSON.stringify(defaultData)));
  localStorage.setItem(currentDataKey, JSON.stringify(window.appData));
  return window.appData;
};
let pieChartInstance = null;

window.selectedMonth = (function () {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
})();


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("input-date").valueAsDate = new Date();
  const isDark = document.documentElement.classList.contains("dark");
  document.getElementById("theme-icon").className = isDark
    ? "fas fa-sun"
    : "fas fa-moon";
  document.getElementById("theme-icon-login").className = isDark
    ? "fas fa-sun"
    : "fas fa-moon";

  // Status login ditentukan oleh Firebase (js/firebase-sync.js).
  document.getElementById("view-login").style.display = "flex";
  document.getElementById("app-layout").classList.add("hidden");
  showAuthPanel("loading");
});

function toggleTheme() {
  const html = document.documentElement;
  if (!prefersReducedMotion()) {
    html.classList.add("theme-transition");
    clearTimeout(window.__themeTimer);
    window.__themeTimer = setTimeout(() => html.classList.remove("theme-transition"), 400);
  }
  const icon = document.getElementById("theme-icon");
  const iconLogin = document.getElementById("theme-icon-login");

  if (html.classList.contains("dark")) {
    html.classList.remove("dark");
    localStorage.theme = "light";
    icon.className = "fas fa-moon";
    iconLogin.className = "fas fa-moon";
  } else {
    html.classList.add("dark");
    localStorage.theme = "dark";
    icon.className = "fas fa-sun";
    iconLogin.className = "fas fa-sun";
  }
  if (pieChartInstance || trendChartInstance) updateDashboard();
}

// ================= AKUN & LOGIN =================
// Kode lisensi yang sudah dicek di langkah 1, dipakai saat daftar di langkah 2.
let pendingLicenseCode = null;

function showAuthPanel(name) {
  document.querySelectorAll(".auth-panel").forEach((el) => {
    el.classList.toggle("hidden", el.id !== `auth-panel-${name}`);
  });
  if (name === "register" && !pendingLicenseCode) showAuthPanel("activate");
}

function showLoginScreen(panel = "login") {
  document.getElementById("app-layout").classList.add("hidden");
  document.getElementById("view-login").style.display = "flex";
  showAuthPanel(panel);
}

function setFormBusy(form, busy, label = "Memproses...") {
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${label}`;
  } else if (btn.dataset.label) {
    btn.innerHTML = btn.dataset.label;
  }
  btn.disabled = busy;
}

function authReady() {
  if (window.sgAuth) return true;
  showToast("Sedang menyiapkan koneksi, coba lagi sebentar.", "warning");
  return false;
}

// Ubah 08xx / +628xx / 628xx menjadi format 628xx
function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("8")) digits = "62" + digits;
  return digits;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function submitLogin(e) {
  e.preventDefault();
  if (!authReady()) return;
  const form = e.target;
  const id = document.getElementById("login-id-input").value.trim();
  const password = document.getElementById("login-password-input").value;
  if (!id || !password) {
    showToast("Isi email/no. HP dan password.", "warning");
    return;
  }
  setFormBusy(form, true, "Masuk...");
  try {
    await window.sgAuth.login(id, password);
  } catch (err) {
    showToast(err.message || "Gagal masuk.", "error");
  } finally {
    setFormBusy(form, false);
  }
}

async function submitLicenseCode(e) {
  e.preventDefault();
  if (!authReady()) return;
  const form = e.target;
  const code = document
    .getElementById("access-code-input")
    .value.trim()
    .toUpperCase();
  if (!code) {
    showToast("Masukkan kode lisensi.", "warning");
    return;
  }
  setFormBusy(form, true, "Memeriksa...");
  try {
    const res = await window.sgAuth.checkLicense(code);
    if (res.valid) {
      pendingLicenseCode = code;
      showToast(res.message || "Kode lisensi valid.", "success");
      showAuthPanel("register");
    } else {
      showToast(res.message || "Kode lisensi tidak valid.", "error");
    }
  } catch (err) {
    showToast(
      "Gagal terhubung ke server lisensi. Pastikan internet lancar.",
      "error",
    );
  } finally {
    setFormBusy(form, false);
  }
}

async function submitRegister(e) {
  e.preventDefault();
  if (!authReady()) return;
  const form = e.target;
  const nama = document.getElementById("reg-name-input").value.trim();
  const email = document.getElementById("reg-email-input").value.trim();
  const phone = normalizePhone(
    document.getElementById("reg-phone-input").value,
  );
  const password = document.getElementById("reg-password-input").value;
  const password2 = document.getElementById("reg-password2-input").value;

  if (!nama || !email || !phone || !password) {
    showToast("Semua data wajib diisi!", "warning");
    return;
  }
  if (!isValidEmail(email)) {
    showToast("Format email salah!", "warning");
    return;
  }
  if (!/^62\d{8,13}$/.test(phone)) {
    showToast("Nomor HP tidak valid. Contoh: 081234567890", "warning");
    return;
  }
  if (password.length < 8) {
    showToast("Password minimal 8 karakter.", "warning");
    return;
  }
  if (password !== password2) {
    showToast("Ulangi password tidak sama.", "warning");
    return;
  }

  setFormBusy(form, true, "Mendaftarkan...");
  try {
    await window.sgAuth.register({
      licenseCode: pendingLicenseCode,
      nama,
      email,
      phone,
      password,
    });
    pendingLicenseCode = null;
    showToast("Pendaftaran terkirim. Menunggu persetujuan admin.", "success");
  } catch (err) {
    showToast(err.message || "Pendaftaran gagal.", "error");
  } finally {
    setFormBusy(form, false);
  }
}

async function forgotPassword() {
  if (!authReady()) return;
  const id = document.getElementById("login-id-input").value.trim();
  if (!id) {
    showToast("Isi email atau no. HP dulu, lalu klik Lupa password.", "warning");
    return;
  }
  try {
    await window.sgAuth.resetPassword(id);
    showToast("Link ganti password sudah dikirim ke email Anda.", "success");
  } catch (err) {
    showToast(err.message || "Gagal mengirim email.", "error");
  }
}

// Dipanggil oleh firebase-sync.js setelah akun disetujui
function unlockApp(profile = {}) {
  const login = document.getElementById("view-login");
  const layout = document.getElementById("app-layout");
  const wasVisible = login.style.display !== "none" && !document.getElementById("auth-panel-loading").offsetParent;
  if (wasVisible && !prefersReducedMotion()) {
    login.classList.add("login-exit");
    setTimeout(() => {
      login.style.display = "none";
      login.classList.remove("login-exit");
    }, 350);
  } else {
    login.style.display = "none";
  }
  layout.classList.remove("hidden");
  layout.classList.add("app-enter");
  setTimeout(() => layout.classList.remove("app-enter"), 600);

  const userName = profile.nama || "Member";
  const userEmail = profile.email || "";
  localStorage.setItem("SAKUGENIUS_USER_NAME", userName);
  localStorage.setItem("SAKUGENIUS_USER_EMAIL", userEmail);
  document.getElementById("sidebar-user-initial").innerText = userName
    .charAt(0)
    .toUpperCase();
  document.getElementById("sidebar-user-name").innerText = userName;
  document.getElementById("sidebar-user-email").innerText = userEmail;

  updateAllUI();
  switchView("dashboard");
}

function logoutAccount() {
  if (window.sgAuth) window.sgAuth.logout();
  else window.location.reload();
}

function logout() {
  Modal.confirm(
    "Yakin ingin keluar dari akun ini?",
    () => logoutAccount(),
    true,
  );
}

// FITUR BARU: Toast berwarna merah untuk Error Debugging
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  let bg =
    type === "success"
      ? "bg-green-600"
      : type === "warning"
        ? "bg-amber-500"
        : "bg-red-600";
  let icon =
    type === "success" ? "fa-check-circle" : "fa-exclamation-triangle";

  toast.className = `toast flex items-center gap-3 ${bg} text-white px-5 py-4 rounded-xl shadow-lg font-medium text-sm min-w-[300px]`;
  toast.innerHTML = `<i class="fas ${icon} text-lg"></i> <p class="flex-1">${escapeHtml(message)}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 5000); // Diperpanjang jadi 5 detik untuk baca error
}

// === FUNGSI SINKRONISASI UPDATE DATA ===
window.updateDataFromCloud = function (cloudData) {
  cloudData = { ...(cloudData || {}) };
  // Cloud versi lama (Rules belum diperbarui) tidak punya recurring/goals: pakai yang lokal
  ["recurring", "goals"].forEach((k) => {
    if (cloudData[k] === undefined && Array.isArray(window.appData[k])) cloudData[k] = window.appData[k];
  });
  cloudData = ensureDataShape(cloudData);
  if (JSON.stringify(window.appData) === JSON.stringify(cloudData))
    return;

  window.appData = cloudData;
  if (currentDataKey)
    localStorage.setItem(currentDataKey, JSON.stringify(window.appData));
  updateAllUI();
};

function saveData() {
  if (currentDataKey)
    localStorage.setItem(currentDataKey, JSON.stringify(window.appData));
  if (window.firebaseSaveHook) window.firebaseSaveHook(window.appData);
  updateAllUI();
}

function generateId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}
// Mengamankan teks buatan pengguna sebelum dimasukkan ke HTML (mencegah XSS)
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ID hanya boleh huruf, angka, "_" dan "-" karena dipakai di atribut onclick
function safeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
}

// ================= MOTION HELPERS =================
const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Angka berjalan dari nilai sebelumnya ke nilai baru
function animateRupiah(el, to, prefix = "") {
  if (!el) return;
  const from = typeof el._value === "number" ? el._value : 0;
  el._value = to;
  if (el._raf) cancelAnimationFrame(el._raf);
  if (prefersReducedMotion() || from === to) {
    el.innerText = prefix + formatRupiah(to);
    return;
  }
  const duration = 800;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.innerText = prefix + formatRupiah(Math.round(from + (to - from) * eased));
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function chartAnimation() {
  return prefersReducedMotion() ? false : { duration: 700, easing: "easeOutQuart" };
}

// Status ikon sinkron di header: "saving" | "saved"
window.setSyncState = function (state) {
  const el = document.getElementById("cloud-sync-indicator");
  if (!el) return;
  el.classList.remove("hidden");
  const icon = el.querySelector("i");
  const label = el.querySelector("span");
  clearTimeout(el._timer);
  el.classList.remove("sync-saved");
  if (state === "saving") {
    icon.className = "fas fa-rotate fa-spin text-green-500";
    label.innerText = "Menyimpan";
  } else {
    void el.offsetWidth;
    el.classList.add("sync-saved");
    icon.className = "fas fa-circle-check text-green-500";
    label.innerText = "Tersimpan";
    el._timer = setTimeout(() => {
      icon.className = "fas fa-cloud text-green-500";
      label.innerText = "Sinkron";
      el.classList.remove("sync-saved");
    }, 1600);
  }
};

function formatRupiah(angka) {
  const sign = angka < 0 ? "−" : "";
  return sign + "Rp " + Math.abs(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function switchView(viewName) {
  document
    .querySelectorAll(".view-section")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById("view-" + viewName).classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    input: "Catat Transaksi",
    data: "Riwayat Keuangan",
    settings: "Pengaturan Sistem",
  };
  document.getElementById("header-title").innerText = titles[viewName];

  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active-nav"));
  document
    .querySelector(`.nav-btn[data-target="${viewName}"]`)
    ?.classList.add("active-nav");
  document
    .querySelectorAll(".nav-btn-mobile")
    .forEach((btn) => btn.classList.remove("active-nav-mobile"));
  document
    .querySelector(`.nav-btn-mobile[data-target="${viewName}"]`)
    ?.classList.add("active-nav-mobile");

  if (viewName === "dashboard") updateDashboard();
}

function changeFilterMonth(val) {
  if (!val) return;
  window.selectedMonth = val;
  updateAllUI();
}

function updateAllUI() {
  if (document.getElementById("filter-month-dash"))
    document.getElementById("filter-month-dash").value =
      window.selectedMonth;
  if (document.getElementById("filter-month-data"))
    document.getElementById("filter-month-data").value =
      window.selectedMonth;
  updateCategoryDropdown();
  updateCategoryList();
  updateTransactionList();
  updateDashboard();
  if (window.renderExtraFeatures) window.renderExtraFeatures();
}

function updateCategoryDropdown() {
  const type = document.getElementById("input-type").value;
  const selectCat = document.getElementById("input-category");
  selectCat.innerHTML = "";
  window.appData.categories
    .filter((c) => c.jenis === type)
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.nama;
      opt.innerText = c.nama;
      selectCat.appendChild(opt);
    });
}

// Fungsi untuk memberikan titik (separator ribuan) saat user mengetik
function formatInputRupiah(input) {
  let value = input.value.replace(/\D/g, ""); // Hapus karakter non-angka
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Tambahkan titik
}

function saveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById("input-id").value;
  const jenis = document.getElementById("input-type").value;
  const kategori = document.getElementById("input-category").value;
  
  // Hapus titik pemisah sebelum mengubahnya menjadi angka integer untuk database
  const rawNominal = document.getElementById("input-amount").value.replace(/\./g, "");
  const nominal = parseInt(rawNominal);
  
  const tgl = document.getElementById("input-date").value;

  const formData = {
    id: id || generateId(),
    tanggal: tgl,
    nama: document.getElementById("input-name").value,
    jenis: jenis,
    kategori: kategori,
    nominal: nominal,
  };

  const existing = id ? window.appData.transactions.find((t) => t.id === id) : null;
  if (existing && existing.recurringId) formData.recurringId = existing.recurringId;

  // Cek budget sebelum dan sesudah transaksi ini (untuk pengingat 80% / lewat budget)
  let budgetWarned = false;
  if (jenis === "Pengeluaran" && window.checkBudgetAfterSave) {
    budgetWarned = window.checkBudgetAfterSave(kategori, tgl.substring(0, 7), nominal, id);
  }

  if (id) {
    const index = window.appData.transactions.findIndex(
      (t) => t.id === id,
    );
    if (index !== -1) window.appData.transactions[index] = formData;
    if (!budgetWarned) showToast("Transaksi berhasil diperbarui!");
  } else {
    window.appData.transactions.push(formData);
    const repeat = document.getElementById("input-recurring");
    if (repeat && repeat.checked && window.addRecurringFromTransaction) {
      window.addRecurringFromTransaction(formData);
      showToast("Disimpan. Transaksi ini akan dicatat otomatis setiap bulan.");
    } else if (!budgetWarned) {
      showToast("Transaksi berhasil disimpan!");
    }
  }

  window.selectedMonth = tgl.substring(0, 7);
  window.highlightTxId = formData.id;
  clearTimeout(window._highlightTimer);
  window._highlightTimer = setTimeout(() => (window.highlightTxId = null), 8000);
  saveData();
  resetForm();
  playSaveSuccess(e.target);
  if (id) setTimeout(() => switchView("data"), prefersReducedMotion() ? 0 : 450);
}

// Tombol simpan sesaat menjadi tanda centang hijau
function playSaveSuccess(form) {
  const btn = form && form.querySelector('button[type="submit"]');
  if (!btn) return;
  clearTimeout(btn._timer);
  if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
  btn.classList.add("btn-success");
  btn.innerHTML = '<i class="fas fa-check mr-2"></i> Tersimpan';
  btn._timer = setTimeout(() => {
    btn.classList.remove("btn-success");
    btn.innerHTML = btn.dataset.label;
    delete btn.dataset.label;
  }, 1100);
}

function editTransaction(id) {
  const t = window.appData.transactions.find((x) => x.id === id);
  if (!t) return;
  document.getElementById("input-id").value = t.id;
  document.getElementById("input-date").value = t.tanggal;
  document.getElementById("input-name").value = t.nama;
  document.getElementById("input-type").value = t.jenis;
  updateCategoryDropdown();
  document.getElementById("input-category").value = t.kategori;
  document.getElementById("input-amount").value = t.nominal;
  formatInputRupiah(document.getElementById("input-amount"));
  const repeatRow = document.getElementById("input-recurring-row");
  if (repeatRow) repeatRow.classList.add("hidden");
  switchView("input");
}

function deleteTransaction(id) {
  Modal.confirm(
    "Yakin ingin menghapus transaksi ini?",
    () => {
      const finish = () => {
        window.appData.transactions = window.appData.transactions.filter(
          (t) => t.id !== id,
        );
        saveData();
        showToast("Transaksi dihapus.");
      };
      const card = document.querySelector(`[data-tx-id="${safeId(id)}"]`);
      if (!card || prefersReducedMotion()) return finish();
      card.style.maxHeight = card.offsetHeight + "px";
      void card.offsetHeight;
      card.classList.add("motion-remove");
      setTimeout(finish, 320);
    },
    true,
  );
}

function resetForm() {
  document.getElementById("input-id").value = "";
  document.getElementById("input-name").value = "";
  document.getElementById("input-amount").value = "";
  document.getElementById("input-type").value = "Pengeluaran";
  const repeat = document.getElementById("input-recurring");
  if (repeat) repeat.checked = false;
  const repeatRow = document.getElementById("input-recurring-row");
  if (repeatRow) repeatRow.classList.remove("hidden");
  updateCategoryDropdown();
}

// === LAPORAN PDF: PRATINJAU DULU, LALU DOWNLOAD ===
let pdfMonth = null;

// Isi template laporan untuk bulan ym (YYYY-MM). Mengembalikan jumlah transaksi.
function fillPdfTemplate(ym) {
  const txs = window.appData.transactions
    .filter((t) => t.tanggal && t.tanggal.startsWith(ym))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const monthName = new Date(ym + "-01T00:00:00")
    .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    .toUpperCase();
  document.getElementById("pdf-month-title").innerText = monthName;
  document.getElementById("pdf-print-date").innerText = new Date().toLocaleString("id-ID");

  const userName = localStorage.getItem("SAKUGENIUS_USER_NAME") || "Member SakuGenius";
  document.getElementById("pdf-user-name").innerText = userName.toUpperCase();
  document.getElementById("pdf-user-email").innerText =
    localStorage.getItem("SAKUGENIUS_USER_EMAIL") || "-";

  // Ringkasan
  const totals = monthTotals(ym);
  let balance = 0;
  window.appData.transactions.forEach((t) => {
    balance += t.jenis === "Pemasukan" ? t.nominal : -t.nominal;
  });
  document.getElementById("pdf-total-in").innerText = formatRupiah(totals.income);
  document.getElementById("pdf-total-out").innerText = formatRupiah(totals.expense);
  document.getElementById("pdf-balance").innerText = formatRupiah(balance);

  // Monitor anggaran: kategori pengeluaran yang punya budget
  const spent = {};
  txs.forEach((t) => {
    if (t.jenis !== "Pemasukan") spent[t.kategori] = (spent[t.kategori] || 0) + t.nominal;
  });
  const budgets = window.appData.categories.filter(
    (c) => c.jenis === "Pengeluaran" && Number(c.budget) > 0,
  );
  const grid = document.getElementById("pdf-budget-grid");
  grid.innerHTML = budgets
    .map((c) => {
      const used = spent[c.nama] || 0;
      const pct = (used / c.budget) * 100;
      const color = pct > 100 ? "#dc2626" : pct >= 100 ? "#f59e0b" : "#1f2937";
      return `
        <div style="padding: 10px 0 8px;">
          <div style="display:flex; justify-content:space-between; gap:8px; font-size:10px;">
            <span style="font-weight:700; text-transform:uppercase;">${escapeHtml(c.nama)}</span>
            <span style="color:#4b5563; white-space:nowrap;">${formatRupiah(used)} / ${formatRupiah(Number(c.budget))}</span>
          </div>
          <div style="height:5px; background:#eef0f4; margin-top:7px;">
            <div style="height:5px; width:${Math.min(pct, 100).toFixed(1)}%; background:${color};"></div>
          </div>
        </div>`;
    })
    .join("");
  document.getElementById("pdf-budget-section").style.display = budgets.length ? "" : "none";

  // Tabel mutasi
  const tbody = document.getElementById("pdf-tx-table-body");
  const cell = "padding-top: 8px; padding-bottom: 8px;";
  tbody.innerHTML = txs.length
    ? txs
        .map((t) => {
          const isIncome = t.jenis === "Pemasukan";
          const [, mm, dd] = t.tanggal.split("-");
          const amount = formatRupiah(t.nominal).replace("Rp ", "");
          return `<tr>
            <td class="py-2 pr-2 align-top" style="${cell}">${dd}/${mm}</td>
            <td class="py-2 pr-2 align-top" style="${cell}">
              <span class="uppercase font-bold">${escapeHtml(t.kategori)}</span><br>
              <span class="text-gray-600">${escapeHtml(t.nama)}</span>
            </td>
            <td class="py-2 text-right align-top" style="${cell}">${isIncome ? amount : ""}</td>
            <td class="py-2 text-right align-top" style="${cell}">${isIncome ? "" : amount}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="text-center text-gray-500" style="padding: 24px 0;">Tidak ada transaksi di bulan ini.</td></tr>`;

  return txs.length;
}

function openPdfPreview() {
  const modal = document.getElementById("pdf-preview-modal");
  const month = window.selectedMonth || new Date().toISOString().slice(0, 7);
  document.getElementById("pdf-preview-month").value = month;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  renderPdfPreview(month);
  window.addEventListener("resize", fitPdfPreview);
  document.addEventListener("keydown", pdfPreviewKeys);
}

function closePdfPreview() {
  const modal = document.getElementById("pdf-preview-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  window.removeEventListener("resize", fitPdfPreview);
  document.removeEventListener("keydown", pdfPreviewKeys);
}

function pdfPreviewKeys(e) {
  if (e.key === "Escape") closePdfPreview();
}

function renderPdfPreview(ym) {
  if (!ym) return;
  pdfMonth = ym;
  const count = fillPdfTemplate(ym);
  const page = document.getElementById("pdf-preview-page");
  const clone = document.getElementById("pdf-report-template").cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  page.innerHTML = "";
  page.appendChild(clone);
  const btn = document.getElementById("pdf-download-btn");
  btn.disabled = count === 0;
  btn.title = count === 0 ? "Tidak ada transaksi di bulan ini" : "";
  fitPdfPreview();
  const scroller = document.getElementById("pdf-preview-scroll");
  scroller.scrollTop = 0;
}

// Kecilkan halaman 800px supaya muat di layar HP
function fitPdfPreview() {
  const scroller = document.getElementById("pdf-preview-scroll");
  const sizer = document.getElementById("pdf-preview-sizer");
  const page = document.getElementById("pdf-preview-page");
  const style = getComputedStyle(scroller);
  const avail =
    scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = Math.min(1, avail / 800);
  page.style.transform = `scale(${scale})`;
  sizer.style.width = 800 * scale + "px";
  sizer.style.height = page.offsetHeight * scale + "px";
}

async function downloadPDF() {
  const ym = pdfMonth || window.selectedMonth;
  const btn = document.getElementById("pdf-download-btn");
  const originalText = btn.innerHTML;
  if (fillPdfTemplate(ym) === 0) {
    showToast(`Tidak ada data transaksi di bulan ${ym}.`, "warning");
    return;
  }
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan...';
  btn.disabled = true;

  const wrapper = document.getElementById("pdf-wrapper");
  try {
    wrapper.style.display = "block";
    const opt = {
      margin: 5,
      filename: `Laporan_SakuGenius_${ym}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        x: 0,
        y: 0,
        width: 800,
        windowWidth: 785,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] },
    };
    await html2pdf().set(opt).from(document.getElementById("pdf-report-template")).save();
    showToast("Laporan PDF berhasil diunduh!", "success");
  } catch (e) {
    console.error(e);
    showToast("Gagal membuat PDF.", "error");
  } finally {
    wrapper.style.display = "none";
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

let typeFilter = "Semua";

function setTypeFilter(type) {
  typeFilter = type;
  updateTransactionList();
}

function openNewTransaction() {
  resetForm();
  document.getElementById("input-date").valueAsDate = new Date();
  switchView("input");
}

function updateTransactionList() {
  const container = document.getElementById("transaction-list");
  const noData = document.getElementById("no-transaction");
  const summary = document.getElementById("transaction-summary");
  container.innerHTML = "";

  document.querySelectorAll(".type-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.type === typeFilter);
  });

  const query = (document.getElementById("search-transaction")?.value || "").trim().toLowerCase();
  const txsBulanIni = window.appData.transactions.filter((t) => t.tanggal.startsWith(window.selectedMonth));
  const shown = txsBulanIni.filter(
    (t) =>
      (typeFilter === "Semua" || t.jenis === typeFilter) &&
      (!query || `${t.nama} ${t.kategori}`.toLowerCase().includes(query)),
  );

  // Ringkasan hasil yang tampil
  let inc = 0,
    exp = 0;
  shown.forEach((t) => (t.jenis === "Pemasukan" ? (inc += t.nominal) : (exp += t.nominal)));
  summary.innerHTML = shown.length
    ? `<div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
         <p class="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Masuk</p>
         <p class="num font-bold text-emerald-700 dark:text-emerald-300">${formatRupiah(inc)}</p>
       </div>
       <div class="rounded-xl bg-rose-50 dark:bg-rose-900/20 px-4 py-3">
         <p class="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">Keluar</p>
         <p class="num font-bold text-rose-700 dark:text-rose-300">${formatRupiah(exp)}</p>
       </div>`
    : "";

  if (shown.length === 0) {
    noData.classList.remove("hidden");
    noData.querySelector("p.font-medium").innerText = txsBulanIni.length
      ? "Tidak ada yang cocok"
      : "Kelihatan kosong di sini...";
    noData.querySelector("p.text-sm").innerText = txsBulanIni.length
      ? "Coba kata kunci atau filter lain."
      : "Belum ada transaksi di bulan ini.";
    return;
  }
  noData.classList.add("hidden");

  const sorted = [...shown].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  const byDate = {};
  sorted.forEach((t) => (byDate[t.tanggal] = byDate[t.tanggal] || []).push(t));

  let index = 0;
  Object.keys(byDate).forEach((tanggal) => {
    const items = byDate[tanggal];
    const dayNet = items.reduce((sum, t) => sum + (t.jenis === "Pemasukan" ? t.nominal : -t.nominal), 0);
    const dh = document.createElement("div");
    dh.className =
      "flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mt-5 mb-2 pb-1 border-b border-gray-100 dark:border-gray-700";
    dh.innerHTML = `<span>${new Date(tanggal).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })}</span><span class="num ${dayNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500"}">${
      dayNet >= 0 ? "+" : "-"
    } ${formatRupiah(Math.abs(dayNet))}</span>`;
    container.appendChild(dh);

    items.forEach((t) => {
      const isIncome = t.jenis === "Pemasukan";
      const color = isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-white";
      const bgIcon = isIncome
        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400";
      const icon = isIncome ? "fa-arrow-down" : "fa-arrow-up";
      const sign = isIncome ? "+" : "-";
      const delay = index < 8 ? `animation-delay: ${index * 60}ms;` : "";
      index++;

      const card = document.createElement("div");
      card.dataset.txId = safeId(t.id);
      if (window.highlightTxId && t.id === window.highlightTxId) {
        card.classList.add("motion-highlight");
      }
      card.className +=
        " motion-slide-up bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl flex justify-between items-center group transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50";
      card.style = delay;
      card.innerHTML = `
          <div class="flex items-center gap-4 min-w-0">
              <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${bgIcon}"><i class="fas ${icon}"></i></div>
              <div class="min-w-0">
                  <p class="font-semibold text-gray-900 dark:text-white text-sm truncate">${escapeHtml(t.nama)}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(t.kategori)}</p>
              </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
              <p class="num font-bold ${color} text-sm whitespace-nowrap">${sign} ${formatRupiah(t.nominal)}</p>
              <div class="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onclick="editTransaction('${safeId(t.id)}')" class="btn-press text-gray-400 hover:text-primary p-1" title="Ubah"><i class="fas fa-edit"></i></button>
                  <button onclick="deleteTransaction('${safeId(t.id)}')" class="btn-press text-gray-400 hover:text-red-500 p-1" title="Hapus"><i class="fas fa-trash"></i></button>
              </div>
          </div>`;
      container.appendChild(card);
    });
  });
}

function updateCategoryList() {
  const container = document.getElementById("category-list");
  container.innerHTML = "";
  window.appData.categories.forEach((c, index) => {
    const bg =
      c.jenis === "Pemasukan"
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    const bud =
      c.budget > 0
        ? `<br><span class="text-xs text-gray-500 dark:text-gray-400">Budget: ${formatRupiah(c.budget)}</span>`
        : "";
    const item = document.createElement("div");
    const delay = index < 10 ? `animation-delay: ${index * 50}ms;` : "";
    item.className =
      "motion-slide-up flex justify-between items-center p-3 border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow";
    item.style = delay;
    item.innerHTML = `
        <div>
            <p class="text-sm font-bold text-gray-800 dark:text-gray-200">${escapeHtml(c.nama)}</p>
            <span class="text-[10px] px-2 py-0.5 rounded-md font-medium mt-1 inline-block ${bg}">${c.jenis}</span> ${bud}
        </div>
        <div class="flex gap-1">
            <button onclick="editCategory('${safeId(c.id)}')" class="btn-press text-gray-300 hover:text-blue-500 p-2 transition-colors" title="Edit"><i class="fas fa-edit"></i></button>
            <button onclick="deleteCategory('${safeId(c.id)}')" class="btn-press text-gray-300 hover:text-red-500 p-2 transition-colors" title="Hapus"><i class="fas fa-times"></i></button>
        </div>`;
    container.appendChild(item);
  });
}

function editCategory(id) {
  const cat = window.appData.categories.find((c) => c.id === id);
  if (!cat) return;
  document.getElementById("edit-cat-id").value = cat.id;
  document.getElementById("new-cat-type").value = cat.jenis;
  document.getElementById("new-cat-name").value = cat.nama;
  document.getElementById("new-cat-budget").value = cat.budget || "";
  document.getElementById("cat-submit-btn").innerHTML =
    '<i class="fas fa-save mr-1"></i> Update';
  document.getElementById("cat-cancel-btn").classList.remove("hidden");
}

function cancelEditCategory() {
  document.getElementById("edit-cat-id").value = "";
  document.getElementById("new-cat-name").value = "";
  document.getElementById("new-cat-budget").value = "";
  document.getElementById("cat-submit-btn").innerHTML =
    '<i class="fas fa-plus mr-1"></i> Tambah';
  document.getElementById("cat-cancel-btn").classList.add("hidden");
}

function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById("edit-cat-id").value;
  const jenis = document.getElementById("new-cat-type").value;
  const nama = document.getElementById("new-cat-name").value;
  const budget =
    parseInt(document.getElementById("new-cat-budget").value) || 0;

  if (
    !id &&
    window.appData.categories.find(
      (c) => c.nama.toLowerCase() === nama.toLowerCase(),
    )
  ) {
    showToast("Nama kategori sudah ada!", "warning");
    return;
  }
  if (id) {
    const index = window.appData.categories.findIndex((c) => c.id === id);
    if (index !== -1) {
      const namaLama = window.appData.categories[index].nama;
      window.appData.transactions.forEach((t) => {
        if (t.kategori === namaLama) t.kategori = nama;
      });
      window.appData.categories[index] = { id, jenis, nama, budget };
      showToast("Kategori & Budget diperbarui!");
    }
  } else {
    window.appData.categories.push({
      id: generateId(),
      jenis,
      nama,
      budget,
    });
    showToast("Kategori baru ditambahkan!");
  }
  saveData();
  cancelEditCategory();
}

function deleteCategory(id) {
  Modal.confirm(
    "Hapus kategori ini? (Riwayat transaksi aman)",
    () => {
      window.appData.categories = window.appData.categories.filter(
        (c) => c.id !== id,
      );
      saveData();
      showToast("Kategori dihapus.");
    },
    true,
  );
}

let trendChartInstance = null;

// "2026-11" -> "2026-10"
function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthTotals(ym) {
  let income = 0,
    expense = 0;
  window.appData.transactions.forEach((t) => {
    if (!t.tanggal || !t.tanggal.startsWith(ym)) return;
    if (t.jenis === "Pemasukan") income += t.nominal;
    else expense += t.nominal;
  });
  return { income, expense };
}

// Teks perbandingan dengan bulan lalu. goodWhenUp: naik = bagus (pemasukan)
function renderDelta(el, now, before, goodWhenUp) {
  if (!el) return;
  if (!before) {
    el.className = "text-xs mt-2 min-h-[1rem] text-gray-400";
    el.innerText = now ? "Belum ada data bulan lalu" : "Belum ada transaksi bulan ini";
    return;
  }
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  const good = up === goodWhenUp;
  el.className = `text-xs mt-2 min-h-[1rem] font-semibold ${
    pct === 0
      ? "text-gray-400"
      : good
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400"
  }`;
  el.innerHTML = `<i class="fas ${up ? "fa-arrow-trend-up" : "fa-arrow-trend-down"} mr-1"></i>${
    up ? "+" : ""
  }${pct}% dari bulan lalu`;
}

function updateDashboard() {
  let catDataBulanIni = {};
  let totalSaldoAllTime = 0;

  window.appData.transactions.forEach((t) => {
    if (t.jenis === "Pemasukan") totalSaldoAllTime += t.nominal;
    else totalSaldoAllTime -= t.nominal;
    if (t.jenis !== "Pemasukan" && t.tanggal.startsWith(window.selectedMonth)) {
      catDataBulanIni[t.kategori] = (catDataBulanIni[t.kategori] || 0) + t.nominal;
    }
  });

  const now = monthTotals(window.selectedMonth);
  const prev = monthTotals(shiftMonth(window.selectedMonth, -1));

  animateRupiah(document.getElementById("dash-income"), now.income);
  animateRupiah(document.getElementById("dash-expense"), now.expense);
  animateRupiah(document.getElementById("dash-balance"), totalSaldoAllTime);
  renderDelta(document.getElementById("dash-income-delta"), now.income, prev.income, true);
  renderDelta(document.getElementById("dash-expense-delta"), now.expense, prev.expense, false);
  const net = now.income - now.expense;
  document.getElementById("dash-net-month").innerText =
    `Selisih bulan ini: ${net >= 0 ? "+" : "−"}${formatRupiah(Math.abs(net))}`;

  renderBudgetTable(catDataBulanIni);
  renderTrendChart();

  const ctx = document.getElementById("expenseChart");
  const noData = document.getElementById("no-chart-data");

  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = null;
  if (Object.keys(catDataBulanIni).length === 0) {
    noData.classList.remove("hidden");
    ctx.style.display = "none";
    return;
  }
  noData.classList.add("hidden");
  ctx.style.display = "block";

  const isDark = document.documentElement.classList.contains("dark");
  const entries = Object.entries(catDataBulanIni).sort((a, b) => b[1] - a[1]);
  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [
        {
          data: entries.map((e) => e[1]),
          backgroundColor: ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnimation() && { ...chartAnimation(), animateRotate: true, animateScale: true },
      cutout: "72%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: isDark ? "#cbd5e1" : "#475569",
            boxWidth: 10,
            usePointStyle: true,
            padding: 14,
            font: { family: "'Inter', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((x, y) => x + y, 0);
              return ` ${c.label}: ${formatRupiah(c.parsed)} (${Math.round((c.parsed / total) * 100)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderTrendChart() {
  const ctx = document.getElementById("trendChart");
  if (!ctx || typeof Chart === "undefined") return;
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(window.selectedMonth, -i));
  const totals = months.map(monthTotals);
  const labels = months.map((ym) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short" });
  });
  const isDark = document.documentElement.classList.contains("dark");
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)";
  const tick = isDark ? "#94a3b8" : "#64748b";

  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Pemasukan", data: totals.map((t) => t.income), backgroundColor: "#10b981", borderRadius: 6, maxBarThickness: 28 },
        { label: "Pengeluaran", data: totals.map((t) => t.expense), backgroundColor: "#f43f5e", borderRadius: 6, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnimation(),
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${formatRupiah(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tick, font: { family: "'Inter', sans-serif" } } },
        y: {
          beginAtZero: true,
          grid: { color: grid },
          border: { display: false },
          ticks: {
            color: tick,
            font: { family: "'Inter', sans-serif" },
            callback: (v) => (v >= 1e6 ? `${v / 1e6} jt` : v >= 1e3 ? `${v / 1e3} rb` : v),
          },
        },
      },
    },
  });
}

function renderBudgetTable(catDataBulanIni) {
  const list = document.getElementById("budget-list");
  const noData = document.getElementById("no-budget-data");
  list.innerHTML = "";

  const expCats = window.appData.categories.filter((c) => c.jenis === "Pengeluaran");
  if (expCats.length === 0) {
    noData.classList.remove("hidden");
    return;
  }
  noData.classList.add("hidden");

  // Urutkan: yang paling mendekati/lewat budget di atas
  const rows = expCats
    .map((c) => {
      const terpakai = catDataBulanIni[c.nama] || 0;
      const pct = c.budget > 0 ? (terpakai / c.budget) * 100 : null;
      return { c, terpakai, pct };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  rows.forEach(({ c, terpakai, pct }) => {
    let bar = "bg-emerald-500",
      note = "";
    if (pct === null) {
      bar = "bg-gray-300 dark:bg-gray-600";
      note = `<span class="text-gray-400 italic">Tanpa budget</span>`;
    } else if (pct > 100) {
      bar = "bg-rose-500 budget-over";
      note = `<span class="text-rose-600 dark:text-rose-400 font-semibold">Lewat ${formatRupiah(terpakai - c.budget)}</span>`;
    } else {
      if (pct >= 75) bar = "bg-amber-500";
      note = `<span class="text-gray-500 dark:text-gray-400">Sisa ${formatRupiah(c.budget - terpakai)}</span>`;
    }
    const width = pct === null ? (terpakai > 0 ? 100 : 0) : Math.min(pct, 100);

    const row = document.createElement("div");
    row.innerHTML = `
      <div class="flex justify-between items-baseline gap-3 mb-1.5">
        <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(c.nama)}</p>
        <p class="text-xs num whitespace-nowrap text-gray-500 dark:text-gray-400">
          <span class="font-semibold text-gray-800 dark:text-gray-100">${formatRupiah(terpakai)}</span>${
            c.budget > 0 ? ` / ${formatRupiah(c.budget)}` : ""
          }
        </p>
      </div>
      <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div class="budget-bar h-full rounded-full ${bar}" style="width:0%"></div>
      </div>
      <div class="flex justify-between text-xs mt-1 num">
        ${note}
        <span class="text-gray-400">${pct === null ? "" : Math.round(pct) + "%"}</span>
      </div>`;
    list.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector(".budget-bar").style.width = width + "%";
    });
  });
}
