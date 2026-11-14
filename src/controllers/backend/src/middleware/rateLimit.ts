// ===========================================================================
// RATE LIMIT — batasi percobaan login / lupa password supaya tidak bisa ditebak-tebak.
// Disimpan di memori (reset kalau server restart). Cukup untuk proyek ini.
// ===========================================================================
interface Hit {
  count: number;
  resetAt: number;
}

export interface Limiter {
  blockedFor(key: string): number;
  fail(key: string): void;
  clear(key: string): void;
}

export function createLimiter({ windowMs, max }: { windowMs: number; max: number }): Limiter {
  const hits = new Map<string, Hit>(); // key -> { count, resetAt }

  function current(key: string): Hit | null {
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

export function tooManyMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`;
}