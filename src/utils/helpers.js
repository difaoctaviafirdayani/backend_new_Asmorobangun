// ===========================================================================
// FUNGSI BANTU yang dipakai di banyak modul.
// ===========================================================================

// Urutkan dari yang terbaru. key = nama field tanggal.
function sortNewest(list, key = "date") {
  return [...list].sort((a, b) => new Date(b[key]) - new Date(a[key]));
}

// Buang field yang tidak boleh diubah lewat PATCH (misalnya id).
function omit(obj, keys) {
  const out = { ...(obj || {}) };
  keys.forEach((k) => delete out[k]);
  return out;
}

// Nomor HP -> format seragam (08xxxx). "+62 812-3456" -> "0812 3456" -> "08123456"
function normalizePhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Teks aman untuk dicari (tidak error kalau field kosong)
const lower = (v) => String(v == null ? "" : v).toLowerCase();

module.exports = { sortNewest, omit, normalizePhone, normalizeEmail, EMAIL_REGEX, lower };
