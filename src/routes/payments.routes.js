const express = require("express");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/payments/settings -- info rekening bank & QRIS merchant.
// Tidak ada lagi verifikasi nomor HP/OTP: pembeli yang sudah login langsung bisa melihatnya.
router.get("/settings", requireAuth, (req, res) => {
  const db = readDB();
  res.json({ settings: db.paymentSettings });
});

// PATCH /api/payments/settings -- admin mengubah rekening / merchant QRIS / gambar QRIS
router.patch("/settings", requireAuth, requireAdmin, async (req, res) => {
  const { bankName, accountNumber, accountName, qrisMerchantName, qrisImage, whatsapp } = req.body;
  await update((data) => {
    Object.assign(data.paymentSettings, {
      ...(bankName !== undefined && { bankName }),
      ...(accountNumber !== undefined && { accountNumber }),
      ...(accountName !== undefined && { accountName }),
      ...(qrisMerchantName !== undefined && { qrisMerchantName }),
      ...(qrisImage !== undefined && { qrisImage }),
      ...(whatsapp !== undefined && { whatsapp }),
    });
  });
  res.json({ message: "Pengaturan pembayaran diperbarui." });
});

module.exports = router;
