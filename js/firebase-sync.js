import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
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

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  signInAnonymously(auth).catch((error) => {
    console.error("Gagal Login Anonim Firebase:", error);
  });

  onAuthStateChanged(auth, (user) => {
    window.currentUser = user;
    if (user && localStorage.getItem("SAKUGENIUS_ACCESS") === "GRANTED") {
      if (window.setupCloudSync) window.setupCloudSync();
    }
  });
} catch (e) {
  console.error("Gagal inisialisasi Firebase:", e);
}

window.setupCloudSync = function () {
  if (!window.currentUser || !db) return;
  const email = localStorage.getItem("SAKUGENIUS_USER_EMAIL");
  if (!email) return;

  const emailId = email.replace(/[^a-zA-Z0-9]/g, "_");
  const userDocRef = doc(db, "sakugenius_sync", emailId);

  if (window.unsubFirestore) window.unsubFirestore();

  window.unsubFirestore = onSnapshot(
    userDocRef,
    (docSnap) => {
      document
        .getElementById("cloud-sync-indicator")
        .classList.remove("hidden");

      if (docSnap.exists()) {
        if (window.updateDataFromCloud)
          window.updateDataFromCloud(docSnap.data());
      } else {
        if (window.appData) {
          const cleanData = JSON.parse(JSON.stringify(window.appData));
          setDoc(userDocRef, cleanData).catch((e) => console.error(e));
        }
      }
    },
    (error) => {
      console.error("Cloud Sync Error:", error);
    },
  );
};

window.firebaseSaveHook = async function (data) {
  if (!window.currentUser || !db) return;
  const email = localStorage.getItem("SAKUGENIUS_USER_EMAIL");
  if (!email) return;

  const emailId = email.replace(/[^a-zA-Z0-9]/g, "_");
  const userDocRef = doc(db, "sakugenius_sync", emailId);

  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(userDocRef, cleanData);
  } catch (e) {
    console.error("Gagal simpan ke Cloud:", e);
  }
};
