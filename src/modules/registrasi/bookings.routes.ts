// ===========================================================================
// REGISTRASI › BOOKING KELAS / SEWA / EVENT
// Base URL: /api/bookings
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import { makeUploader } from "../../utils/upload";
import * as c from "./bookings.controller";

const router = Router();
const uploadProof = makeUploader("payment_proof");

// ----- Pengguna (harus login) -----
router.post("/", requireAuth, asyncHandler(c.create));                 // buat booking
router.get("/mine", requireAuth, asyncHandler(c.listMine));            // booking milik saya
router.get("/:id/qris", requireAuth, asyncHandler(c.getQris));         // QRIS pembayaran
router.get("/:id/transfer", requireAuth, asyncHandler(c.getTransfer)); // info rekening transfer
router.post("/:id/proof", requireAuth, ...uploadProof.single("proof"), asyncHandler(c.uploadProof)); // upload bukti bayar
router.post("/:id/cash", requireAuth, asyncHandler(c.payCash));        // bayar tunai di lokasi

// ----- Admin -----
router.get("/", requireAuth, requireAdmin, asyncHandler(c.listAll));                  // semua booking
router.patch("/:id/status", requireAuth, requireAdmin, asyncHandler(c.updateStatus)); // ubah status

export default router;