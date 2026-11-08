import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaGcDbi4OdMj6UZtX1tnsWbUssCu7sd5k",
  authDomain: "sakugenius-app.firebaseapp.com",
  databaseURL:
    "https://sakugenius-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sakugenius-app",
  storageBucket: "sakugenius-app.firebasestorage.app",
  messagingSenderId: "793297223197",
  appId: "1:793297223197:web:381ecd51ca9b4a1c3510f4",
};

// URL Web App Google Apps Script (lisensi + pendaftaran + Telegram)
const LICENSE_API_URL =
  "https://script.google.com/macros/s/AKfycbxAYA0LTEJv8KKjLkiuauKRuS7ZrhjZHwr2CoerlN0llvbrQL_I69IN5skSUDtpdEaq/exec";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "id";
const db = getFirestore(app);

let unsubMember = null;
let unsubData = null;
let activeUid = null;

// ---------- Pesan error dalam Bahasa Indonesia ----------
function friendlyError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/invalid-credential": "Email/no. HP atau password salah.",
    "auth/wrong-password": "Email/no. HP atau password salah.",
    "auth/user-not-found": "Akun tidak ditemukan.",
    "auth/invalid-email": "Format email salah.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk.",
    "auth/weak-password": "Password terlalu lemah (minimal 8 karakter).",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
    "auth/network-request-failed": "Tidak ada koneksi internet.",
  };
  return new Error(map[code] || err.message || "Terjadi kesalahan.");
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("8")) digits = "62" + digits;
  return digits;
}

// Panggil Apps Script. Content-Type text/plain agar tidak memicu CORS preflight.
async function callLicenseApi(payload) {
  const res = await fetch(LICENSE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Email atau no. HP -> email untuk login Firebase
async function resolveEmail(id) {
  if (id.includes("@")) return id.trim();
  const phone = normalizePhone(id);
  if (!phone) throw new Error("Isi email atau no. HP yang valid.");
  const snap = await getDoc(doc(db, "phoneIndex", phone));
  if (!snap.exists()) throw new Error("No. HP belum terdaftar.");
  return snap.data().email;
}

// ---------- Fungsi yang dipakai js/app.js ----------
window.sgAuth = {
  async checkLicense(code) {
    return callLicenseApi({ action: "checkLicense", kode: code });
  },

  async login(id, password) {
    try {
      const email = await resolveEmail(id);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw err.code ? friendlyError(err) : err;
    }
  },

  async register({ licenseCode, nama, email, phone, password }) {
    // No. HP harus belum dipakai akun lain
    const phoneSnap = await getDoc(doc(db, "phoneIndex", phone));
    if (phoneSnap.exists()) throw new Error("No. HP ini sudah terdaftar. Silakan masuk.");

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw friendlyError(err);
    }

    try {
      const idToken = await cred.user.getIdToken();
      const res = await callLicenseApi({
        action: "register",
        kode: licenseCode,
        idToken,
        nama,
        phone,
      });
      if (!res.ok) throw new Error(res.message || "Pendaftaran ditolak server.");
    } catch (err) {
      // Batalkan akun Firebase agar pengguna bisa mencoba lagi
      await cred.user.delete().catch(() => signOut(auth));
      throw err;
    }
  },

  async resetPassword(id) {
    try {
      const email = await resolveEmail(id);
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw err.code ? friendlyError(err) : err;
    }
  },

  async logout() {
    stopListeners();
    await signOut(auth);
    window.location.reload();
  },
};

function stopListeners() {
  if (unsubMember) unsubMember();
  if (unsubData) unsubData();
  unsubMember = unsubData = null;
}

// ---------- Status akun ----------
onAuthStateChanged(auth, (user) => {
  stopListeners();
  activeUid = null;
  if (!user) {
    window.showLoginScreen("login");
    return;
  }

  let unlocked = false;
  unsubMember = onSnapshot(
    doc(db, "members", user.uid),
    (snap) => {
      const member = snap.exists() ? snap.data() : null;
      const status = member ? member.status : null;

      if (status === "approved") {
        if (!unlocked) {
          unlocked = true;
          startApp(user, member);
        }
        return;
      }
      if (unlocked) {
        // Akses dicabut saat aplikasi terbuka
        window.location.reload();
        return;
      }
      if (status === "pending" || status === null) {
        // null = pendaftaran baru saja dikirim dan dokumen belum dibuat server
        document.getElementById("pending-email").innerText = user.email || "";
        window.showLoginScreen("pending");
      } else {
        window.showLoginScreen("rejected");
      }
    },
    (error) => {
      console.error("Gagal membaca status akun:", error);
      window.showLoginScreen("rejected");
      document.getElementById("rejected-message").innerText =
        "Status akun tidak bisa diperiksa. Periksa koneksi internet lalu coba lagi.";
    },
  );
});

// ---------- Data per akun ----------
async function startApp(user, member) {
  activeUid = user.uid;
  window.loadLocalDataForUser(user.uid, user.email);
  window.unlockApp({ nama: member.nama, email: user.email });

  const dataRef = doc(db, "userData", user.uid);
  try {
    const snap = await getDoc(dataRef);
    if (!snap.exists()) {
      // Pertama kali: pindahkan data cloud lama (versi lisensi) jika ada
      const legacy = await loadLegacyCloudData(user.email);
      const initial = legacy || window.appData;
      await writeUserData(user.uid, initial);
    }
  } catch (e) {
    console.error("Gagal menyiapkan data cloud:", e);
  }

  if (activeUid !== user.uid) return;
  unsubData = onSnapshot(
    dataRef,
    (snap) => {
      document.getElementById("cloud-sync-indicator").classList.remove("hidden");
      if (snap.exists() && window.updateDataFromCloud)
        window.updateDataFromCloud(snap.data());
      if (snap.exists() && window.runAutoTasks) window.runAutoTasks();
    },
    (error) => console.error("Cloud Sync Error:", error),
  );
}

async function loadLegacyCloudData(email) {
  // ID dokumen lama = email dengan karakter selain huruf/angka diganti "_"
  const candidates = new Set();
  const savedEmail = localStorage.getItem("SAKUGENIUS_USER_EMAIL");
  if (savedEmail && savedEmail.toLowerCase() === email.toLowerCase())
    candidates.add(savedEmail.replace(/[^a-zA-Z0-9]/g, "_"));
  candidates.add(email.replace(/[^a-zA-Z0-9]/g, "_"));

  for (const id of candidates) {
    try {
      const snap = await getDoc(doc(db, "sakugenius_sync", id));
      if (snap.exists()) return snap.data();
    } catch (e) {
      console.warn("Data lama tidak bisa dibaca:", e.code || e);
    }
  }
  return null;
}

// Jika Rules Firestore belum diperbarui, simpan bagian lama saja (transaksi + kategori)
let extrasAllowed = true;

function clean(data, withExtras = extrasAllowed) {
  const d = JSON.parse(JSON.stringify(data || {}));
  const out = {
    transactions: Array.isArray(d.transactions) ? d.transactions : [],
    categories: Array.isArray(d.categories) ? d.categories : [],
  };
  if (withExtras) {
    out.recurring = Array.isArray(d.recurring) ? d.recurring : [];
    out.goals = Array.isArray(d.goals) ? d.goals : [];
  }
  return out;
}

async function writeUserData(uid, data) {
  const ref = doc(db, "userData", uid);
  try {
    await setDoc(ref, clean(data));
  } catch (e) {
    if (e && e.code === "permission-denied" && extrasAllowed) {
      console.warn("Rules Firestore belum mengizinkan recurring/goals; disimpan tanpa keduanya.");
      extrasAllowed = false;
      await setDoc(ref, clean(data, false));
    } else {
      throw e;
    }
  }
}

window.firebaseSaveHook = async function (data) {
  if (!activeUid) return;
  if (window.setSyncState) window.setSyncState("saving");
  try {
    await writeUserData(activeUid, data);
    if (window.setSyncState) window.setSyncState("saved");
  } catch (e) {
    console.error("Gagal simpan ke Cloud:", e);
  }
};
