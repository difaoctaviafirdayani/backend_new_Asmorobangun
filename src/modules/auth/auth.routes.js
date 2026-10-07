// ===========================================================================
// AUTH — daftar, login, lupa password, ganti password, profil, foto profil
// Base URL: /api/auth
// ===========================================================================
const express = require("express");
const { requireAuth } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./auth.controller");

const router = express.Router();

router.get("/password-policy", c.passwordPolicy);                       // aturan password (untuk ditampilkan di form)
router.post("/register", asyncHandler(c.register));                     // daftar akun baru
router.post("/login", asyncHandler(c.login));                           // masuk
router.post("/reset-password", asyncHandler(c.resetPassword));          // LUPA PASSWORD (email + no HP -> password baru)
router.post("/change-password", requireAuth, asyncHandler(c.changePassword)); // ganti password saat sudah login
router.get("/me", requireAuth, c.me);                                   // data akun yang sedang login
router.post("/me/avatar", requireAuth, c.uploadAvatar, asyncHandler(c.saveAvatar)); // ganti foto profil
router.delete("/me/avatar", requireAuth, asyncHandler(c.removeAvatar)); // hapus foto profil

module.exports = router;
