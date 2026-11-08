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

Opsional: `GEMINI_MODEL` untuk mengganti model (bawaan `gemini-2.5-flash`).
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
