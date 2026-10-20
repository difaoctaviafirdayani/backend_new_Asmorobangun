# Asmorobangun — Backend (API)

Express + penyimpanan file JSON (`data/db.json`). Jalan di http://localhost:4000

## Cara menjalankan
```bash
npm install
cp .env.example .env     # opsional
npm start
```
Cek: buka http://localhost:4000/api/health → `{"ok":true,...}` (butuh Node.js 18+)

Kalau ada akun dengan email ganda di `db.json`, jalankan sekali: `npm run fix:users`

## Struktur folder (dikelompokkan)
```
server.js                  titik masuk (npm start)
src/
  app.js                   pasang middleware + file statis + route
  routes.js                PETA SEMUA ENDPOINT (mulai cari dari sini)
  config/env.js            semua pengaturan .env
  database/db.js           baca/tulis data/db.json
  middleware/              auth.js, error.js, rateLimit.js, absoluteUrls.js
  utils/                   password.js, helpers.js, upload.js
  modules/
    auth/        akun: daftar, login, lupa/ganti password, profil
    registrasi/  booking kelas, pesanan topeng, pengaturan pembayaran
    layanan/     fasilitas & ulasan, katalog topeng
    informasi/   artikel, pengumuman, galeri, edukasi budaya, FAQ
    komunitas/   forum, pencarian, asisten topeng (AI)
    admin/       statistik dashboard, upload gambar
scripts/                   skrip sekali jalan (fix-duplicate-users.js)
data/db.json               data
uploads/                   file unggahan
```
Tiap modul: `*.routes.js` = daftar URL, `*.controller.js` = isi logikanya.

## Aturan password
Hanya **huruf (A-Z, a-z) dan angka (0-9)**, 6–64 karakter. Spasi, titik, koma, strip, dan simbol lain ditolak.
Login akun pengguna juga ditolak kalau password berisi karakter selain huruf/angka (akun admin dikecualikan).

## Akun & keamanan
- Email unik (tidak bisa daftar dua kali, huruf besar/kecil dianggap sama).
- Lupa password: `POST /api/auth/reset-password` {email, phone, newPassword, confirmPassword?}
  — hanya berhasil kalau email **dan** nomor HP cocok dengan saat daftar.
- Setelah password diganti, semua sesi login lama otomatis keluar.
- Login & lupa password dibatasi 8x / 5x percobaan salah per 15 menit.

## Menyambung ke frontend
- **Next.js (user/admin):** pakai `NEXT_PUBLIC_API_URL=http://localhost:4000`. Gambar datang sebagai `/uploads/...`, tinggal digabung dengan alamat backend.
- **Flutter:** emulator Android memakai `http://10.0.2.2:4000`, HP asli memakai IP laptop (mis. `http://192.168.1.10:4000`).
  Kirim header `X-Absolute-Urls: 1` supaya semua URL gambar dikirim lengkap (`http://.../uploads/...`).
- Semua request yang butuh login: header `Authorization: Bearer <token>`.
- Error selalu berbentuk `{ "error": "pesan" }`.
