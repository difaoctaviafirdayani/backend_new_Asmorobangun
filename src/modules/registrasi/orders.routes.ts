// ===========================================================================
// REGISTRASI › PESANAN TOPENG (pembeli + admin)
// Base URL: /api/topeng   (path /orders/... dan /admin/orders/...)
// Dipasang SEBELUM katalog topeng supaya "/orders" tidak tertukar dengan "/:id".
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import { makeUploader } from "../../utils/upload";
import * as c from "./orders.controller";

const router = Router();
const uploadProof = makeUploader("payment_proof");

// ----- Pembeli -----
router.post("/:id/order", requireAuth, asyncHandler(c.create));                 // buat pesanan (id = id topeng)
router.get("/orders/mine", requireAuth, asyncHandler(c.listMine));              // pesanan saya
router.get("/orders/:orderId", requireAuth, asyncHandler(c.getOne));            // detail pesanan
router.get("/orders/:orderId/qris", requireAuth, asyncHandler(c.getQris));      // QRIS
router.get("/orders/:orderId/transfer", requireAuth, asyncHandler(c.getTransfer)); // rekening transfer
router.post("/orders/:orderId/proof", requireAuth, ...uploadProof.single("proof"), asyncHandler(c.uploadProof)); // bukti bayar
router.post("/orders/:orderId/cash", requireAuth, asyncHandler(c.payCash));     // bayar tunai

// ----- Admin -----
router.get("/admin/orders", requireAuth, requireAdmin, asyncHandler(c.listAll));
router.patch("/admin/orders/:orderId/status", requireAuth, requireAdmin, asyncHandler(c.updateStatus));

export default router;