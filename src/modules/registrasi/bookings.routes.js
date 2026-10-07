// ===========================================================================
// REGISTRASI › BOOKING KELAS / SEWA / EVENT
// Base URL: /api/bookings
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const { makeUploader } = require("../../utils/upload");
const c = require("./bookings.controller");

const router = express.Router();
const uploadProof = makeUploader("payment_proof");

// ----- Pengguna (harus login) -----
router.post("/", requireAuth, asyncHandler(c.create));                 // buat booking
router.get("/mine", requireAuth, c.listMine);                          // booking milik saya
router.get("/:id/qris", requireAuth, asyncHandler(c.getQris));         // QRIS pembayaran
router.get("/:id/transfer", requireAuth, c.getTransfer);               // info rekening transfer
router.post("/:id/proof", requireAuth, uploadProof.single("proof"), asyncHandler(c.uploadProof)); // upload bukti bayar
router.post("/:id/cash", requireAuth, asyncHandler(c.payCash));        // bayar tunai di lokasi

// ----- Admin -----
router.get("/", requireAuth, requireAdmin, c.listAll);                 // semua booking
router.patch("/:id/status", requireAuth, requireAdmin, asyncHandler(c.updateStatus)); // ubah status

module.exports = router;
