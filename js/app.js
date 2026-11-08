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
  window.appData = data || JSON.parse(JSON.stringify(defaultData));
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
  if (pieChartInstance) updateDashboard();
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
  document.getElementById("view-login").style.display = "none";
  document.getElementById("app-layout").classList.remove("hidden");

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

function formatRupiah(angka) {
  return "Rp " + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

  if (jenis === "Pengeluaran") {
    const catInfo = window.appData.categories.find(
      (c) => c.nama === kategori,
    );
    if (catInfo && catInfo.budget > 0) {
      const bulanTransaksi = tgl.substring(0, 7);
      const pemakaianLama = window.appData.transactions
        .filter(
          (t) =>
            t.kategori === kategori &&
            t.jenis === "Pengeluaran" &&
            t.id !== id &&
            t.tanggal.startsWith(bulanTransaksi),
        )
        .reduce((sum, t) => sum + t.nominal, 0);
      if (pemakaianLama + nominal > catInfo.budget)
        showToast(
          `Pengeluaran "${kategori}" melebihi budget bulanan!`,
          "warning",
        );
    }
  }

  if (id) {
    const index = window.appData.transactions.findIndex(
      (t) => t.id === id,
    );
    if (index !== -1) window.appData.transactions[index] = formData;
    showToast("Transaksi berhasil diperbarui!");
  } else {
    window.appData.transactions.push(formData);
    if (jenis !== "Pengeluaran")
      showToast("Transaksi berhasil disimpan!");
  }

  window.selectedMonth = tgl.substring(0, 7);
  saveData();
  resetForm();
  if (id) switchView("data");
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
  switchView("input");
}

function deleteTransaction(id) {
  Modal.confirm(
    "Yakin ingin menghapus transaksi ini?",
    () => {
      window.appData.transactions = window.appData.transactions.filter(
        (t) => t.id !== id,
      );
      saveData();
      showToast("Transaksi dihapus.");
    },
    true,
  );
}

function resetForm() {
  document.getElementById("input-id").value = "";
  document.getElementById("input-name").value = "";
  document.getElementById("input-amount").value = "";
  document.getElementById("input-type").value = "Pengeluaran";
  updateCategoryDropdown();
}

// === FITUR EKSPOR PDF ESTETIK (BCA STYLE & A4 PRECISE) ===
async function downloadPDF() {
  const txsBulanIni = window.appData.transactions.filter((t) =>
    t.tanggal.startsWith(window.selectedMonth),
  );
  if (txsBulanIni.length === 0) {
    showToast(
      `Tidak ada data transaksi di bulan ${window.selectedMonth}.`,
      "warning",
    );
    return;
  }

  const btn = document.querySelector('button[onclick="downloadPDF()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan...';
  btn.disabled = true;

  try {
    const wrapper = document.getElementById("pdf-wrapper");
    const template = document.getElementById("pdf-report-template");

    // Format text bulan
    const dateObj = new Date(window.selectedMonth + "-01");
    const monthName = dateObj
      .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
      .toUpperCase();
    document.getElementById("pdf-month-title").innerText = monthName;
    document.getElementById("pdf-print-date").innerText =
      new Date().toLocaleString("id-ID");

    // User Info
    const userName =
      localStorage.getItem("SAKUGENIUS_USER_NAME") || "MEMBER SAKUGENIUS";
    document.getElementById("pdf-user-name").innerText =
      userName.toUpperCase();
    document.getElementById("pdf-user-email").innerText =
      localStorage.getItem("SAKUGENIUS_USER_EMAIL") || "-";

    // Ambil angka dari Dashboard HTML
    document.getElementById("pdf-total-in").innerText =
      document.getElementById("dash-income").innerText;
    document.getElementById("pdf-total-out").innerText =
      document.getElementById("dash-expense").innerText;
    document.getElementById("pdf-balance").innerText =
      document.getElementById("dash-balance").innerText;

    // 2. Populate Tabel Transaksi
    const tbody = document.getElementById("pdf-tx-table-body");
    tbody.innerHTML = "";

    // Sort Terlama ke Terbaru
    const sortedTxs = [...txsBulanIni].sort(
      (a, b) => new Date(a.tanggal) - new Date(b.tanggal),
    );

    sortedTxs.forEach((t) => {
      const isIncome = t.jenis === "Pemasukan";
      const d = new Date(t.tanggal);
      const dateBcaFmt =
        String(d.getDate()).padStart(2, "0") +
        "/" +
        String(d.getMonth() + 1).padStart(2, "0");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="py-2 pr-2 align-top" style="padding-top: 8px; padding-bottom: 8px;">${dateBcaFmt}</td>
        <td class="py-2 pr-2 align-top" style="padding-top: 8px; padding-bottom: 8px;">
          <span class="uppercase font-bold">${escapeHtml(t.kategori)}</span><br>
          <span class="text-gray-600">${escapeHtml(t.nama)}</span>
        </td>
        <td class="py-2 text-right align-top" style="padding-top: 8px; padding-bottom: 8px;">${isIncome ? formatRupiah(t.nominal).replace("Rp ", "") : ""}</td>
        <td class="py-2 text-right align-top" style="padding-top: 8px; padding-bottom: 8px;">${!isIncome ? formatRupiah(t.nominal).replace("Rp ", "") : ""}</td>
      `;
      tbody.appendChild(tr);
    });

    // Munculkan wrapper untuk di capture. Kita pastikan koordinat x:0 y:0
    wrapper.style.display = "block";

    // Konfigurasi html2pdf dengan ukuran window 800px konstan
    const opt = {
      margin: 5,
      filename: `Mutasi_Rekening_SakuGenius_${window.selectedMonth}.pdf`,
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
    };

    await html2pdf().set(opt).from(template).save();
    showToast("Mutasi PDF berhasil diunduh!", "success");
  } catch (e) {
    console.error(e);
    showToast("Gagal membuat PDF.", "error");
  } finally {
    document.getElementById("pdf-wrapper").style.display = "none";
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function updateTransactionList() {
  const container = document.getElementById("transaction-list");
  const noData = document.getElementById("no-transaction");
  container.innerHTML = "";

  const txsBulanIni = window.appData.transactions.filter((t) =>
    t.tanggal.startsWith(window.selectedMonth),
  );

  if (txsBulanIni.length === 0) noData.classList.remove("hidden");
  else {
    noData.classList.add("hidden");
    const sorted = [...txsBulanIni].sort(
      (a, b) => new Date(b.tanggal) - new Date(a.tanggal),
    );
    let lastDate = "";

    sorted.forEach((t, index) => {
      if (t.tanggal !== lastDate) {
        const dh = document.createElement("div");
        dh.className =
          "text-xs font-bold text-gray-500 dark:text-gray-400 mt-5 mb-2 border-b border-gray-100 dark:border-gray-700 pb-1";
        dh.innerText = new Date(t.tanggal).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        container.appendChild(dh);
        lastDate = t.tanggal;
      }

      const isIncome = t.jenis === "Pemasukan";
      const color = isIncome
        ? "text-green-600 dark:text-green-400"
        : "text-gray-800 dark:text-white";
      const bgIcon = isIncome
        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
      const icon = isIncome ? "fa-arrow-down" : "fa-arrow-up";
      const sign = isIncome ? "+" : "-";
      const delay = index < 5 ? `animation-delay: ${index * 100}ms;` : "";

      const card = document.createElement("div");
      card.className =
        "motion-slide-up card-hover bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl flex justify-between items-center group transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50";
      card.style = delay;
      card.innerHTML = `
          <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center ${bgIcon}"><i class="fas ${icon}"></i></div>
              <div>
                  <p class="font-bold text-gray-900 dark:text-white text-sm">${escapeHtml(t.nama)}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(t.kategori)}</p>
              </div>
          </div>
          <div class="flex items-center gap-4">
              <p class="font-bold ${color} text-sm whitespace-nowrap">${sign} ${formatRupiah(t.nominal)}</p>
              <div class="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onclick="editTransaction('${safeId(t.id)}')" class="btn-press text-gray-400 hover:text-primary p-1"><i class="fas fa-edit"></i></button>
                  <button onclick="deleteTransaction('${safeId(t.id)}')" class="btn-press text-gray-400 hover:text-red-500 p-1"><i class="fas fa-trash"></i></button>
              </div>
          </div>`;
      container.appendChild(card);
    });
  }
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

function updateDashboard() {
  let inTotalBulanIni = 0,
    exTotalBulanIni = 0,
    catDataBulanIni = {};
  let totalSaldoAllTime = 0;

  window.appData.transactions.forEach((t) => {
    if (t.jenis === "Pemasukan") totalSaldoAllTime += t.nominal;
    else totalSaldoAllTime -= t.nominal;

    if (t.tanggal.startsWith(window.selectedMonth)) {
      if (t.jenis === "Pemasukan") inTotalBulanIni += t.nominal;
      else {
        exTotalBulanIni += t.nominal;
        catDataBulanIni[t.kategori] =
          (catDataBulanIni[t.kategori] || 0) + t.nominal;
      }
    }
  });

  document.getElementById("dash-income").innerText =
    formatRupiah(inTotalBulanIni);
  document.getElementById("dash-expense").innerText =
    formatRupiah(exTotalBulanIni);
  document.getElementById("dash-balance").innerText =
    formatRupiah(totalSaldoAllTime);

  renderBudgetTable(catDataBulanIni);
  const ctx = document.getElementById("expenseChart");
  const noData = document.getElementById("no-chart-data");

  if (pieChartInstance) pieChartInstance.destroy();
  if (Object.keys(catDataBulanIni).length === 0) {
    noData.classList.remove("hidden");
    ctx.style.display = "none";
    return;
  }
  noData.classList.add("hidden");
  ctx.style.display = "block";

  const isDark = document.documentElement.classList.contains("dark");
  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(catDataBulanIni),
      datasets: [
        {
          data: Object.values(catDataBulanIni),
          backgroundColor: [
            "#4f46e5",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#06b6d4",
            "#8b5cf6",
          ],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: isDark ? "#cbd5e1" : "#475569",
            boxWidth: 12,
            padding: 15,
            font: { family: "'Inter', sans-serif", size: 12 },
          },
        },
      },
    },
  });
}

function renderBudgetTable(catDataBulanIni) {
  const tbody = document.getElementById("budget-table-body");
  const noData = document.getElementById("no-budget-data");
  tbody.innerHTML = "";

  const expCats = window.appData.categories.filter(
    (c) => c.jenis === "Pengeluaran",
  );
  if (expCats.length === 0) {
    noData.classList.remove("hidden");
    tbody.parentElement.parentElement.classList.add("hidden");
    return;
  }
  noData.classList.add("hidden");
  tbody.parentElement.parentElement.classList.remove("hidden");

  expCats.forEach((c) => {
    const terpakai = catDataBulanIni[c.nama] || 0;
    const sisa = c.budget - terpakai;
    let sisaClass = "text-gray-900 dark:text-gray-200";
    if (c.budget > 0) {
      if (sisa < 0)
        sisaClass = "text-red-600 dark:text-red-400 font-bold";
      else if (sisa < c.budget * 0.2)
        sisaClass = "text-yellow-600 dark:text-yellow-400 font-bold";
      else sisaClass = "text-green-600 dark:text-green-400 font-bold";
    } else sisaClass = "text-gray-400 dark:text-gray-500 italic";

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td class="px-4 py-4 font-medium text-gray-900 dark:text-white">${escapeHtml(c.nama)}</td>
        <td class="px-4 py-4 text-right">${c.budget > 0 ? formatRupiah(c.budget) : "-"}</td>
        <td class="px-4 py-4 text-right">${formatRupiah(terpakai)}</td>
        <td class="px-4 py-4 text-right ${sisaClass}">${c.budget > 0 ? formatRupiah(sisa) : "-"}</td>`;
    tbody.appendChild(tr);
  });
}
