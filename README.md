# SakuGenius

Aplikasi web untuk mencatat dan mengatur keuangan keluarga: pemasukan, pengeluaran, kategori dengan budget bulanan, grafik, laporan PDF, mode gelap, dan sinkronisasi cloud.

## Struktur folder

| File / folder | Isi |
| --- | --- |
| `index.html` | Tampilan aplikasi (semua halaman) |
| `css/tailwind.css` | CSS Tailwind hasil build (jangan diedit manual) |
| `css/tailwind.input.css` | Sumber untuk build Tailwind |
| `css/style.css` | CSS tambahan: animasi, scrollbar, navigasi aktif |
| `js/app.js` | Logika aplikasi: lisensi, transaksi, kategori, dashboard, PDF |
| `js/firebase-sync.js` | Sinkronisasi data ke Firebase Firestore |
| `Logo.png` | Logo aplikasi (juga dipakai sebagai ikon dan di laporan PDF) |
| `manifest.webmanifest` | Supaya aplikasi bisa ditambahkan ke layar utama HP |
| `firestore.rules` | Aturan keamanan Firestore (dipasang di Firebase Console) |
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

## Keamanan

- **Aturan Firestore:** salin isi `firestore.rules` ke Firebase Console > Firestore Database > Rules, lalu Publish.
- **Batasan saat ini:** data cloud disimpan dengan ID dari email, dan login Firebase bersifat anonim. Perbaikan penuh butuh server lisensi (Google Apps Script) yang mengeluarkan token login Firebase per pengguna, sehingga tiap orang hanya bisa membuka datanya sendiri.
- `apiKey` Firebase di `js/firebase-sync.js` memang boleh terlihat publik; keamanannya diatur oleh aturan Firestore.

## Library yang dipakai

- Tailwind CSS 3.4 (dibuild jadi file statis)
- Chart.js 4.5.1
- html2pdf.js 0.10.1
- Font Awesome 6.4.0
- Firebase JS SDK 12.16.0 (Auth + Firestore)
