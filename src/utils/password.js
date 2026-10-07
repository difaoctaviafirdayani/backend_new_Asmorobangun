// ===========================================================================
// ATURAN PASSWORD — hanya huruf (A-Z, a-z) dan angka (0-9), 6-64 karakter.
// Spasi, titik, koma, strip, dan tanda lain DITOLAK.
// ===========================================================================
const PASSWORD_REGEX = /^[A-Za-z0-9]{6,64}$/;
const ONLY_ALNUM = /^[A-Za-z0-9]+$/;

const PASSWORD_MSG =
  "Password hanya boleh berisi huruf dan angka (tanpa spasi, titik, koma, strip, atau simbol lain).";

const PASSWORD_RULES = {
  minLength: 6,
  maxLength: 64,
  pattern: "^[A-Za-z0-9]{6,64}$",
  description: "Password 6-64 karakter, hanya huruf dan angka.",
};

// Mengembalikan pesan error (string) atau null kalau password sudah benar.
function passwordError(password) {
  if (typeof password !== "string" || !password) return "Password wajib diisi.";
  if (password.length < 6) return "Password minimal 6 karakter.";
  if (password.length > 64) return "Password maksimal 64 karakter.";
  if (!PASSWORD_REGEX.test(password)) return PASSWORD_MSG;
  return null;
}

module.exports = { PASSWORD_REGEX, ONLY_ALNUM, PASSWORD_MSG, PASSWORD_RULES, passwordError };
