# SakuGenius

Aplikasi web untuk mencatat dan mengatur keuangan keluarga: pemasukan, pengeluaran, kategori dengan budget bulanan, grafik, laporan PDF (dengan pratinjau), catat pakai suara, foto struk, transaksi rutin, target tabungan, pengingat budget, ekspor/impor Excel (CSV), mode gelap, dan sinkronisasi cloud.

## Struktur folder

| File / folder | Isi |
| --- | --- |
| `index.html` | Tampilan aplikasi (semua halaman) |
| `css/tailwind.css` | CSS Tailwind hasil build (jangan diedit manual) |
| `css/tailwind.input.css` | Sumber untuk build Tailwind |
| `css/style.css` | CSS tambahan: animasi, scrollbar, navigasi aktif |
| `js/app.js` | Logika aplikasi: lisensi, transaksi, kategori, dashboard, PDF |
| `js/firebase-sync.js` | Sinkronisasi data ke Firebase Firestore |
| `js/voice.js` | Catat pakai suara: ucapan diubah jadi isian form transaksi |
| `js/receipt.js` | Foto struk: total belanja dibaca (OCR Tesseract.js di perangkat) lalu mengisi form |
| `js/features.js` | Transaksi rutin, target tabungan, pengingat budget, ekspor/impor CSV |
| `Logo.png` | Logo aplikasi (juga dipakai sebagai ikon dan di laporan PDF) |
| `manifest.webmanifest` | Supaya aplikasi bisa ditambahkan ke layar utama HP |
| `firestore.rules` | Aturan keamanan Firestore (dipasang di Firebase Console) |
| `apps-script/` | Kode Google Apps Script: cek lisensi, pendaftaran akun, persetujuan Telegram |
| `docs/PANDUAN-LOGIN-BARU.md` | Panduan pemasangan login akun + persetujuan Telegram |
| `tailwind.config.js`, `package.json` | Konfigurasi build Tailwind |

## Menjalankan di komputer

Aplikasi ini berupa file statis, jadi cukup dibuka lewat server lokal sederhana:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` (atau alamat yang ditampilkan).

## Mengubah tampilan (class Tailwind)

Jika menambah atau mengganti class Tailwind di `index.html` atau `js/`, build ulang CSS-nya:

```bash
npm install        # sekali saja
npm run build:css  # atau: npm run watch:css selama mengedit
```

Lalu commit file `css/tailwind.css` yang baru. Setelah mengubah file CSS/JS, naikkan angka `?v=` di `index.html` supaya browser pengguna mengambil versi terbaru.

## Login dan keamanan

- Kode lisensi dipakai **sekali** saat membuat akun. Setelah itu pengguna login dengan email atau no. HP + password (Firebase Authentication).
- Akun baru berstatus **menunggu** sampai admin menekan **Setujui** di Telegram.
- Data keuangan (transaksi, kategori, transaksi rutin, target tabungan) disimpan di `userData/{uid}` dan hanya bisa dibaca pemilik akun yang sudah disetujui (lihat `firestore.rules`).
- Data lama (versi kode lisensi) dipindahkan otomatis saat pengguna pertama kali login.
- Cara pemasangan lengkap: [docs/PANDUAN-LOGIN-BARU.md](docs/PANDUAN-LOGIN-BARU.md).
- `apiKey` Firebase di `js/firebase-sync.js` memang boleh terlihat publik; keamanannya diatur oleh aturan Firestore.

## Library yang dipakai

- Tailwind CSS 3.4 (dibuild jadi file statis)
- Chart.js 4.5.1
- html2pdf.js 0.10.1
- Font Awesome 6.4.0
- Tesseract.js 5.1.1 (baca teks struk, dimuat hanya saat fitur foto struk dipakai)
- Firebase JS SDK 12.16.0 (Authentication Email/Password + Firestore)
