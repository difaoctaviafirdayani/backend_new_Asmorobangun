// ===========================================================================
// FUNGSI BANTU untuk semua controller (validasi input, id, slug, dll).
// ===========================================================================
import { nanoid } from "nanoid";
import { httpError } from "../middleware/error";
import type { AuthUser } from "../types/auth";
import { CANCEL_REASON_MAX, CANCEL_REASON_MIN, REFUND_ACCOUNT_MAX } from "../config/rules";

// Id baru, contoh: newId("art") -> "art-Ab3dE9xZ"
export const newId = (prefix: string): string => `${prefix}-${nanoid(8)}`;

// Ambil teks dari input: dipangkas spasi, dibatasi panjangnya. Bukan string -> "".
export function text(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Teks wajib diisi, kalau kosong -> error 400.
export function requiredText(v: unknown, label: string, max = 5000): string {
  const t = text(v, max);
  if (!t) throw httpError(400, `${label} wajib diisi.`);
  return t;
}

// Teks opsional: undefined -> undefined (tidak diubah), selain itu dipangkas.
export function optionalText(v: unknown, max = 5000): string | undefined {
  return v === undefined ? undefined : text(v, max);
}

export function toNumber(v: unknown, label: string, { min = 0, max = 1e12, integer = true } = {}): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw httpError(400, `${label} tidak valid.`);
  }
  return n;
}

export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return slug || "artikel";
}

// Gambar yang boleh disimpan: URL http(s) atau path "/uploads/...". Kosong -> null.
export function imageValue(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return text(v, 255);
}

// Pastikan user login (req.user dipasang oleh requireAuth).
export function currentUser(user: AuthUser | undefined): AuthUser {
  if (!user) throw httpError(401, "Kamu harus login untuk melakukan ini.");
  return user;
}

// Hanya pemilik data atau admin.
export function assertOwnerOrAdmin(user: AuthUser, ownerId: string | null | undefined): void {
  if (user.role !== "admin" && user.id !== ownerId) throw httpError(403, "Kamu tidak punya akses ke data ini.");
}

// Ambil hanya field yang diizinkan dari body.
export function pick(body: any, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of keys) if (body && body[k] !== undefined) out[k] = body[k];
  return out;
}

// Status yang boleh dipakai admin untuk booking & pesanan.
export const STATUSES = [
  "menunggu_konfirmasi_admin",
  "menunggu_pembayaran",
  "menunggu_verifikasi",
  "diproses",
  "dikonfirmasi",
  "selesai",
  "ditolak",
  "dibatalkan",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  menunggu_konfirmasi_admin: "menunggu konfirmasi admin",
  menunggu_pembayaran: "menunggu pembayaran",
  menunggu_verifikasi: "menunggu verifikasi pembayaran",
  diproses: "sedang diproses",
  dikonfirmasi: "dikonfirmasi",
  selesai: "selesai",
  ditolak: "ditolak",
  dibatalkan: "dibatalkan",
};

// Status akhir: tidak bisa lagi dibayar / diubah pengguna.
export const FINAL_STATUSES = ["selesai", "ditolak", "dibatalkan"];

// Paginasi opsional: ?page=1&limit=20. Tanpa page/limit -> null (respons lama tetap berlaku).
export function parsePaging(
  query: Record<string, unknown>,
  { defaultLimit = 20, maxLimit = 100 } = {},
): { page: number; limit: number; offset: number } | null {
  if (query.page === undefined && query.limit === undefined) return null;
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit)) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}
// Metadata seragam untuk semua daftar: { page, limit, total, totalPages }
export function buildMeta(paging: { page: number; limit: number } | null, total: number) {
  return paging
    ? { page: paging.page, limit: paging.limit, total, totalPages: Math.max(1, Math.ceil(total / paging.limit)) }
    : { page: 1, limit: total, total, totalPages: 1 };
}

export function readCancelInput(
  body: Record<string, unknown> | undefined,
  { refund }: { refund: boolean },
): { reason: string; refundAccount: string | null } {
  const reason = text(body?.reason, CANCEL_REASON_MAX + 1).replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (reason.length < CANCEL_REASON_MIN)
    throw httpError(400, `Alasan pembatalan wajib diisi (minimal ${CANCEL_REASON_MIN} karakter).`);
  if (reason.length > CANCEL_REASON_MAX)
    throw httpError(400, `Alasan pembatalan maksimal ${CANCEL_REASON_MAX} karakter.`);

  const account = text(body?.refundAccount, REFUND_ACCOUNT_MAX + 1).replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!refund) return { reason, refundAccount: null };
  if (account.length < 5)
    throw httpError(400, "Nomor rekening wajib diisi untuk pengembalian dana (contoh: BCA 1234567890 a.n. Nama).");
  if (account.length > REFUND_ACCOUNT_MAX)
    throw httpError(400, `Nomor rekening maksimal ${REFUND_ACCOUNT_MAX} karakter.`);
  return { reason, refundAccount: account };
}
