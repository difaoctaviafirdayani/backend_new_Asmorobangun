// ===========================================================================
// FUNGSI BANTU yang dipakai di banyak modul.
// ===========================================================================

// Urutkan dari yang terbaru. key = nama field tanggal.
export function sortNewest<T extends Record<string, any>>(list: T[], key = "date"): T[] {
  return [...list].sort((a, b) => new Date(b[key]).getTime() - new Date(a[key]).getTime());
}

// Buang field yang tidak boleh diubah lewat PATCH (misalnya id).
export function omit<T extends Record<string, any>>(obj: T | null | undefined, keys: string[]): Partial<T> {
  const out: Record<string, any> = { ...(obj || {}) };
  keys.forEach((k) => delete out[k]);
  return out as Partial<T>;
}

// Nomor HP -> format seragam (08xxxx). "+62 812-3456" -> "08123456"
export function normalizePhone(v: unknown): string {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
}

export function normalizeEmail(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Teks aman untuk dicari (tidak error kalau field kosong)
export const lower = (v: unknown): string => String(v == null ? "" : v).toLowerCase();