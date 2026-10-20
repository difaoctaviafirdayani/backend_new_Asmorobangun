// ===========================================================================
// REGISTRASI › PENGATURAN PEMBAYARAN (rekening bank, QRIS, WhatsApp)
// Base URL: /api/payments
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./payments.controller");

const router = express.Router();

router.get("/settings", requireAuth, c.getSettings);                                 // pengguna login
router.patch("/settings", requireAuth, requireAdmin, asyncHandler(c.updateSettings)); // admin

module.exports = router;
