# Asmorobangun — Backend (API)

Express + database file JSON. Berjalan di http://localhost:4000

## Cara menjalankan
```bash
npm install
npm start
```
Cek: buka http://localhost:4000/api/health → `{"ok":true,...}`

Butuh Node.js 18 ke atas.

## Kebijakan password (register)
Password hanya boleh **huruf (A-Z, a-z) dan angka (0-9)**, panjang 6–64 karakter.
Spasi, titik, koma, strip, dan simbol lain ditolak (HTTP 400). Aturan ada di
`src/routes/auth.routes.js` (`PASSWORD_REGEX`). Login tidak dibatasi supaya akun lama tetap bisa masuk.

## Pengaturan (.env)
`PORT`, `JWT_SECRET`, dan `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` untuk chatbot topeng.
Jangan bagikan `.env` ke publik.

## Untuk tim frontend
Frontend user (port 5173) dan admin (port 5174) memanggil API ini. CORS sudah terbuka.
Akun admin: `admin@asmorobangun.id` (password hash di `data/db.json`).
