# Panduan pemasangan login baru SakuGenius

Panduan ini memasang alur login baru:

1. Pembeli memasukkan **kode lisensi** (sekali saja).
2. Pembeli membuat akun: **nama, email, no. HP, password**.
3. Admin menerima **notifikasi Telegram** dengan tombol **Setujui / Tolak**.
4. Setelah disetujui, pembeli login dengan **email atau no. HP + password**.
5. Kode lisensi, email, no. HP, dan UID akun tercatat di Google Sheet.

Kerjakan langkah di bawah **berurutan dalam satu waktu** (sekitar 30 menit). Script baru (langkah 4) tidak cocok dengan aplikasi lama, dan Rules baru (langkah 6) tidak cocok dengan aplikasi lama, jadi langkah 4 sampai 7 sebaiknya diselesaikan tanpa jeda panjang.

---

## 1. Aktifkan login Email/Password di Firebase

1. Buka https://console.firebase.google.com dan pilih project **sakugenius-app**.
2. Menu kiri: **Build > Authentication**. Jika muncul tombol **Get started**, klik.
3. Tab **Sign-in method** > **Add new provider** > **Email/Password** > aktifkan **Email/Password** (bagian pertama saja) > **Save**.
4. Tab **Settings** > **Authorized domains**: pastikan domain tempat aplikasi di-hosting ada di daftar (misalnya `yusuf-pran.github.io`). Jika belum, klik **Add domain**.
5. (Opsional) Tab **Templates** > **Password reset**: ubah bahasa email ganti password ke Bahasa Indonesia.

## 2. Siapkan Google Sheet lisensi

Script mencari tab bernama **`Lisensi`** (bisa diubah lewat Script Property `SHEET_NAME`). Baris 1 berisi judul kolom. Kolom yang belum ada akan **ditambahkan otomatis** oleh script di sebelah kanan:

| Kolom | Isi |
| --- | --- |
| Kode | Kode lisensi, misalnya `SG-7KQ2-M9XA` (diisi admin) |
| Status | `Dipakai` setelah kode dipakai mendaftar |
| Nama, Email, No HP | Diisi otomatis saat pembeli mendaftar |
| UID | ID akun Firebase, diisi otomatis |
| Status Akun | `Menunggu`, `Disetujui`, atau `Ditolak` |
| Tanggal Daftar, Tanggal Diputuskan | Diisi otomatis |

Catatan untuk **pembeli lama**: jika kolom **Email** pada baris kode sudah terisi (dari sistem lama) dan **UID** masih kosong, pembeli itu bisa mendaftar memakai kode yang sama, **asalkan emailnya sama**. Data keuangan lama mereka ikut dipindahkan otomatis.

Kode baru sebaiknya acak dan panjang (minimal 8 karakter), supaya tidak bisa ditebak.

## 3. Buat bot Telegram

1. Di Telegram, cari **@BotFather** > kirim `/newbot` > ikuti petunjuk (nama bot dan username yang berakhiran `bot`).
2. BotFather memberi **token**, contohnya `123456:ABC-xyz...`. **Token ini rahasia.** Jangan dikirim ke chat mana pun, cukup disalin ke Script Property di langkah 4.
3. Buka bot Anda lalu tekan **Start** (supaya bot boleh mengirim pesan ke Anda).

## 4. Pasang Google Apps Script

1. Buka Google Sheet lisensi > menu **Extensions > Apps Script**. Jika script lisensi lama ada di project lain, buka project itu.
2. **Simpan dulu salinan kode lama** (copy ke file teks) sebagai cadangan.
3. Ganti seluruh isi `Code.gs` dengan isi file [`apps-script/Code.gs`](../apps-script/Code.gs).
4. Klik ikon roda gigi **Project Settings**:
   - Centang **Show "appsscript.json" manifest file in editor**, lalu kembali ke **Editor**, buka `appsscript.json`, dan ganti isinya dengan [`apps-script/appsscript.json`](../apps-script/appsscript.json).
   - Di bagian **Script Properties** > **Add script property**, isi:

| Property | Nilai |
| --- | --- |
| `FIREBASE_API_KEY` | `apiKey` dari `js/firebase-sync.js` |
| `FIREBASE_PROJECT_ID` | `sakugenius-app` |
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_CHAT_ID` | dikosongkan dulu, diisi di langkah 5 |
| `SHEET_ID` | hanya jika script **tidak** dibuka dari Sheet: ID dari URL Sheet (bagian antara `/d/` dan `/edit`) |

5. **Akun Google yang memiliki script harus pemilik project Firebase** (akun yang sama dengan yang membuat Firebase). Script memakai izin akun itu untuk menulis status akun ke Firestore.
6. Deploy ulang Web App:
   - **Deploy > Manage deployments** > pilih deployment yang sekarang > ikon pensil **Edit** > **Version: New version** > **Deploy**.
   - Dengan cara ini **URL Web App tetap sama**, jadi aplikasi tidak perlu diubah.
   - Pastikan **Execute as: Me** dan **Who has access: Anyone**.
   - Saat diminta izin (Authorize access), pilih akun Anda > **Advanced** > **Go to ... (unsafe)** > **Allow**. Ini normal untuk script buatan sendiri.

## 5. Sambungkan Telegram

1. Di editor Apps Script, pilih fungsi **`setupTelegramPolling`** di dropdown atas > klik **Run**. Fungsi ini memasang pemicu yang mengecek tombol Telegram **setiap 1 menit**.
2. Kirim pesan `/start` ke bot Anda. Dalam 1 menit bot membalas **Chat ID** Anda.
3. Masukkan angka itu ke Script Property `TELEGRAM_CHAT_ID`.
4. Pilih fungsi **`testTelegram`** > **Run**. Anda akan menerima pesan "Bot SakuGenius tersambung ✅".

## 6. Pasang Rules Firestore

1. Firebase Console > **Build > Firestore Database** > tab **Rules**.
2. Ganti seluruh isinya dengan isi file [`firestore.rules`](../firestore.rules) > **Publish**.

## 7. Upload aplikasi baru

Merge pull request ini ke `main`. Jika aplikasi di-hosting dari GitHub Pages, aplikasi baru otomatis aktif dalam beberapa menit.

## 8. Uji coba

1. Tambahkan satu kode uji di Sheet, misalnya `TES-0001`.
2. Buka aplikasi > **Aktivasi lisensi** > masukkan `TES-0001` > isi data akun > **Daftar**.
3. Dalam 1 menit, cek Telegram: muncul pesan pendaftaran. Tekan **✅ Setujui**.
4. Aplikasi otomatis terbuka di halaman dashboard.
5. Klik **Keluar**, lalu login lagi memakai **no. HP** + password.
6. Cek Sheet: baris `TES-0001` terisi lengkap dengan Status Akun `Disetujui`.

## Mengelola akun

- **Mencabut akses**: di Firestore, buka koleksi `members` > dokumen UID pengguna > ubah `status` menjadi `rejected`. Aplikasi pengguna langsung terkunci.
- **Pengguna lupa password**: mereka cukup klik **Lupa password?** di halaman masuk.
- **Ganti no. HP pengguna**: hapus dokumen lamanya di koleksi `phoneIndex`, lalu buat dokumen baru dengan ID no. HP baru (format `628xx`) berisi `email` dan `uid`.

## Batasan yang perlu diketahui

- Siapa pun yang tahu **no. HP** seorang pengguna bisa mengetahui **email** yang terhubung dengan no. HP itu, karena aplikasi perlu mengubah no. HP menjadi email untuk login. Password dan data keuangan tetap terlindungi.
- Email tidak diverifikasi otomatis. Pencocokan email dan no. HP dengan data pembelian dilakukan admin sebelum menekan Setujui.
