// ===========================================================================
// RATE LIMIT — batasi percobaan login / lupa password supaya tidak bisa ditebak-tebak.
// Disimpan di memori (reset kalau server restart). Cukup untuk proyek ini.
// ===========================================================================
function createLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  function current(key) {
    const rec = hits.get(key);
    if (!rec || rec.resetAt <= Date.now()) {
      hits.delete(key);
      return null;
    }
    return rec;
  }

  return {
    // Sudah kena blokir? kembalikan sisa detik, kalau belum kembalikan 0.
    blockedFor(key) {
      const rec = current(key);
      if (rec && rec.count >= max) return Math.ceil((rec.resetAt - Date.now()) / 1000);
      return 0;
    },
    // Catat 1 percobaan gagal.
    fail(key) {
      const rec = current(key) || { count: 0, resetAt: Date.now() + windowMs };
      rec.count += 1;
      hits.set(key, rec);
    },
    // Hapus catatan (dipanggil setelah berhasil).
    clear(key) {
      hits.delete(key);
    },
  };
}

function tooManyMessage(seconds) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`;
}

module.exports = { createLimiter, tooManyMessage };
