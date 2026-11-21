export const TOPENG_STATUS = ["menunggu_pembayaran", "menunggu_verifikasi", "diproses", "dikirim", "selesai", "dibatalkan"] as const;

export const BOOKING_STATUS = ["menunggu_pembayaran", "menunggu_verifikasi", "menunggu_kedatangan", "selesai", "dibatalkan"] as const;

export const ARTICLE_CATEGORIES = ["Budaya", "Sejarah", "Pencapaian"] as const;
export const ANNOUNCEMENT_CATEGORIES = ["Umum", "Layanan"] as const;
export const FORUM_CATEGORIES = ["Umum", "Layanan"] as const;

export const PAYMENT_WINDOW_HOURS = 24;
export const PAYMENT_REMINDER_AFTER_HOURS = 12;

export const MAX_REVIEW_IMAGES = 5;

export const SERVICE_PRESETS: Record<string, { price: number; priceInfo: string; availableDays?: number[] }> = {
  "panggilan-tari": { price: 100000, priceInfo: "Rp 100.000" },
  "kunjungan-edukasi": { price: 100000, priceInfo: "Rp 100.000" },
  "les-tari-wisata": { price: 15000, priceInfo: "Rp 15.000 per orang (sekali datang)", availableDays: [6] },
  "les-tari-reguler": { price: 60000, priceInfo: "Rp 60.000" },
  "les-karawitan": { price: 15000, priceInfo: "Rp 15.000", availableDays: [7] },
  "sewa-kostum": { price: 100000, priceInfo: "Rp 100.000" },
};

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const dayLabel = (days: number[]): string => days.map((d) => DAY_NAMES[d - 1]).join(" dan ");

export function pickCategory(value: unknown, allowed: readonly string[], fallback: string): string {
  const v = String(value ?? "").trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v) ?? fallback;
}

export function exactCategory(value: unknown, allowed: readonly string[]): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v) ?? null;
}

export function todayJakarta(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function weekdayOf(dateStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateStr) return null;
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

export function parseDays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<number>();
  for (const e of v) {
    const n = Number(e);
    if (Number.isInteger(n) && n >= 1 && n <= 7) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function daysUntil(dateStr: unknown, now: Date = new Date()): number | null {
  const d = String(dateStr ?? "").trim();
  if (!ISO_DATE.test(d)) return null;
  const ms = Date.parse(`${d}T00:00:00Z`) - Date.parse(`${todayJakarta(now)}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.round(ms / 86_400_000);
}

const BOOKING_CANCELLABLE = ["menunggu_pembayaran", "menunggu_verifikasi", "menunggu_kedatangan"];
const TOPENG_CANCELLABLE = ["menunggu_pembayaran", "menunggu_verifikasi"];
const TOPENG_REVIEWABLE = ["diproses", "dikirim", "selesai"];

export function canCancelBooking(b: { status: string; date?: unknown }, now: Date = new Date()): boolean {
  if (!BOOKING_CANCELLABLE.includes(b.status)) return false;
  const left = daysUntil(b.date, now);
  return left === null ? true : left >= 1;
}

export function canReviewBooking(b: { status: string; date?: unknown }, now: Date = new Date()): boolean {
  if (b.status === "selesai") return true;
  if (b.status !== "menunggu_kedatangan") return false;
  const left = daysUntil(b.date, now);
  return left !== null && left <= 0;
}

export function canCancelTopeng(o: { status: string }): boolean {
  return TOPENG_CANCELLABLE.includes(o.status);
}

export function canReviewTopeng(o: { status: string }): boolean {
  return TOPENG_REVIEWABLE.includes(o.status);
}

export function needsRefund(x: { proofFile?: unknown }): boolean {
  return String(x.proofFile ?? "").trim().length > 0;
}

export const CANCEL_REASON_MIN = 5;
export const CANCEL_REASON_MAX = 300;
export const REFUND_ACCOUNT_MAX = 120;
