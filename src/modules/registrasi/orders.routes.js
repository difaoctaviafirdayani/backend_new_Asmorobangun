// ===========================================================================
// REGISTRASI › PESANAN TOPENG (pembeli + admin)
// Base URL: /api/topeng   (path /orders/... dan /admin/orders/...)
// Dipasang SEBELUM katalog topeng supaya "/orders" tidak tertukar dengan "/:id".
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const { makeUploader } = require("../../utils/upload");
const c = require("./orders.controller");

const router = express.Router();
const uploadProof = makeUploader("payment_proof");

// ----- Pembeli -----
router.post("/:id/order", requireAuth, asyncHandler(c.create));                 // buat pesanan (id = id topeng)
router.get("/orders/mine", requireAuth, c.listMine);                            // pesanan saya
router.get("/orders/:orderId", requireAuth, c.getOne);                          // detail pesanan
router.get("/orders/:orderId/qris", requireAuth, asyncHandler(c.getQris));      // QRIS
router.get("/orders/:orderId/transfer", requireAuth, c.getTransfer);            // rekening transfer
router.post("/orders/:orderId/proof", requireAuth, uploadProof.single("proof"), asyncHandler(c.uploadProof)); // bukti bayar
router.post("/orders/:orderId/cash", requireAuth, asyncHandler(c.payCash));     // bayar tunai

// ----- Admin -----
router.get("/admin/orders", requireAuth, requireAdmin, c.listAll);
router.patch("/admin/orders/:orderId/status", requireAuth, requireAdmin, asyncHandler(c.updateStatus));

module.exports = router;
