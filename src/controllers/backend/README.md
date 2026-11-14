# Asmorobangun — Backend (API)

Express + TypeScript + MySQL. Jalan di http://localhost:4000

## Cara menjalankan
```bash
npm install
# buat file .env (lihat bagian "Pengaturan .env" di bawah)
npm run dev        # development (auto-restart)
npm start          # biasa
npm run typecheck  # cek error TypeScript
```
Syarat: Node.js 18+ dan MySQL yang menyala. Database `asmorobangun` harus sudah dibuat; semua tabel dibuat otomatis saat server pertama kali jalan.
Cek: buka http://localhost:4000/api/health → `{"ok":true,...}`

Kalau ada akun dengan email ganda di `data/db.json` (sumber migrasi lama), jalankan sekali: `npm run fix:users`

## Pengaturan .env
Semua pembacaan `.env` ada di satu file: `src/config/appConfig.ts`.

```dotenv
PORT=4000
JWT_SECRET=<teks acak minimal 32 karakter>

# AI: pilih salah satu penyedia: gemini / groq
AI_PROVIDER=gemini
GEMINI_API_KEY=<dari aistudio.google.com/apikey>
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=<dari console.groq.com/keys, boleh kosong kalau pakai Gemini>
GROQ_MODEL=llama-3.3-70b-versatile

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=asmorobangun
DB_SSL=false

FIREBASE_SERVICE_ACCOUNT=
CORS_ORIGINS=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```
**Jangan pernah commit file `.env`** (sudah ada di `.gitignore`).

## Struktur folder (dikelompokkan)
```
src/
  index.ts                 titik masuk (npm start / npm run dev)
  app.ts                   pasang middleware + file statis + route
  routes.ts                PETA SEMUA ENDPOINT (mulai cari dari sini)
  config/appConfig.ts      semua pengaturan .env
  models/                  model data baru (knowledge.model.ts)
  database/                koneksi MySQL + repository per tabel (*.repo.ts)
  middleware/              auth.ts, error.ts, rateLimit.ts, absoluteUrls.ts
  security/promptGuard.ts  pagar keamanan sebelum teks masuk ke AI
  utils/                   password.ts, helpers.ts, upload.ts, cloud.ts
  modules/
    auth/           akun: daftar, login, lupa/ganti password, profil
    registrasi/     booking kelas, pesanan topeng, pengaturan pembayaran
    layanan/        fasilitas & ulasan, katalog topeng
    informasi/      artikel, pengumuman, galeri, edukasi budaya, FAQ
    komunitas/      forum, pencarian, asisten sanggar (chatbot)
    ai/             pemilih AI, analisis forum, dokumen pengetahuan chatbot
    notifications/  notifikasi & push
    admin/          statistik dashboard, upload gambar, log error
api/index.ts               titik masuk Vercel (serverless)
scripts/                   skrip sekali jalan (fix-duplicate-users.ts)
data/db.json               sumber migrasi lama (data utama ada di MySQL)
uploads/                   file unggahan
```
Tiap modul: `*.routes.ts` = daftar URL, `*.controller.ts` = isi logikanya.

## AI (Gemini / Groq)
- Penyedia AI dipilih lewat `AI_PROVIDER` di `.env`. Ganti penyedia cukup ubah `.env` lalu restart server, tanpa ubah kode. Semua panggilan AI lewat `src/modules/ai/llm.service.ts`; API key tidak pernah dikirim ke frontend.
- **Chatbot asisten sanggar** (`POST /api/ai/chat`, tanpa login, dibatasi 20 pesan/10 menit per IP):
  hanya menjawab dari dokumen Asmorobangun. Sumbernya: dokumen tambahan dari admin + FAQ, edukasi budaya, artikel, fasilitas, dan katalog topeng. Kalau tidak ada dokumen yang cocok, AI tidak dipanggil dan chatbot menjawab bahwa informasi belum ditemukan. Respons berisi `reply`, `mode`, dan `sources` (judul dokumen yang dipakai).
- **Analisis forum** (khusus admin): `POST /api/ai/analyze/thread/:id`, `GET /api/ai/results`, `PATCH /api/ai/results/:id/verify`. Hasil AI harus diverifikasi admin.
- **Dokumen pengetahuan** (khusus admin, `/api/knowledge`):
  - `GET /` daftar dokumen
  - `POST /` tambah dokumen `{ title, content, category?, active? }`
  - `PATCH /:id` ubah dokumen
  - `DELETE /:id` hapus dokumen
  - `GET /status` AI yang aktif + jumlah dokumen
  - `POST /test` uji pencarian `{ question }`
- Teks pengguna selalu lewat `promptGuard`: deteksi prompt injection dan penyamaran data pribadi (email, HP, dll) sebelum dikirim ke AI.

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