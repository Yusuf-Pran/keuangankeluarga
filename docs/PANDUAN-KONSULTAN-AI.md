# Mengaktifkan Konsultan AI (Gemini gratis)

Menu **Konsultan AI** memakai Google Gemini. API key disimpan di Vercel (server),
bukan di kode aplikasi, jadi tidak bisa dilihat atau dicuri pengguna lain.

## 1. Buat API key Gemini (gratis)
1. Buka https://aistudio.google.com/apikey dan login dengan akun Google.
2. Klik **Create API key**, pilih atau buat project, lalu salin kuncinya (diawali `AIza...`).
3. Jangan kirim kunci ini ke chat, email, atau GitHub.

## 2. Simpan di Vercel
1. Buka https://vercel.com, pilih project **keuangankeluarga**.
2. **Settings → Environment Variables**.
3. Tambah variabel:
   - Key: `GEMINI_API_KEY`
   - Value: tempel API key tadi
   - Environments: centang **Production** dan **Preview**
4. Klik **Save**.
5. Buka tab **Deployments**, klik titik tiga pada deployment teratas → **Redeploy**
   (variabel baru hanya terbaca setelah deploy ulang).

Opsional: `GEMINI_MODEL` untuk memilih model. Tanpa itu, server mencoba `gemini-flash-lite-latest`, `gemini-flash-latest`, `gemini-2.5-flash` (dan model pengganti yang disarankan Google), lalu `gemini-2.0-flash`. Model yang penuh (503), kehabisan kuota (429), atau tidak menjawab dalam 20 detik dilewati.
Isi dengan nama model lain dari https://ai.google.dev/gemini-api/docs/models bila model bawaan sudah tidak tersedia.

## 3. Coba
Masuk ke SakuGenius → menu **Konsultan AI** → tekan salah satu contoh pertanyaan.

## Catatan
- Hanya akun yang sudah disetujui (status approved) yang bisa memakai konsultan.
- Batas: 20 pertanyaan per 10 menit per pengguna, ditambah batas kuota gratis Google.
  Jika kuota habis, aplikasi menampilkan pesan "Kuota gratis Gemini sedang habis".
- Data yang dikirim ke Gemini hanya ringkasan: total bulan ini, pengeluaran per kategori
  dan budget, tren 3 bulan, 5 pengeluaran terbesar, target tabungan, dan transaksi rutin.
  Nama akun dan email tidak dikirim.
- Pada paket gratis, Google dapat memakai isi percakapan untuk meningkatkan layanannya.
  Lihat ketentuan di https://ai.google.dev/gemini-api/terms.
- Aturan perilaku konsultan ada di `api/_konsultan-rules.js` dan bisa diubah sesuai kebutuhan.

## Batas 5 chat per bulan

Setiap akun mendapat jatah **5 chat Konsultan AI per bulan**. Jatah ini dihitung di server, jadi pengguna tidak bisa mengubahnya sendiri.

- Yang dihitung hanya jawaban yang **berhasil**. Kalau Gemini sedang error, jatah tidak berkurang.
- Sisa jatah tampil di pojok kanan atas halaman Konsultan, misalnya "Sisa 3/5 chat".
- Jatah kembali penuh setiap awal bulan, mengikuti jam UTC (tanggal 1 pukul 07.00 WIB).
- Hitungannya disimpan di Firestore `konsultanUsage/{uid}`.
- Untuk mengubah jumlah jatahnya, isi Environment Variable `KONSULTAN_LIMIT` di Vercel (misalnya `10`), lalu Redeploy.

**Wajib sekali:** salin isi `firestore.rules` terbaru ke Firebase Console → Firestore Database → Rules, lalu klik **Publish**. Kalau langkah ini belum dilakukan, Konsultan akan menampilkan pesan "aturan Firestore (konsultanUsage) belum diperbarui".
