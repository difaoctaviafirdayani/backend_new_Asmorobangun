// ===========================================================================
// REGISTRASI › BOOKING KELAS / SEWA / EVENT
// Base URL: /api/bookings
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import { makeUploader } from "../../utils/upload";
import * as c from "../../controllers/bookings.controller";
import { bookingReview as rv } from "../../controllers/reviews.controller";

const router = Router();
const uploadProof = makeUploader("payment_proof");
const uploadReviewImage = makeUploader("review", /^\.(jpe?g|png|webp|gif)$/i);

// ----- Pengguna (harus login) -----
router.post("/", requireAuth, asyncHandler(c.create));                 // buat booking
router.get("/mine", requireAuth, asyncHandler(c.listMine));            // booking milik saya
router.get("/:id/qris", requireAuth, asyncHandler(c.getQris));         // QRIS pembayaran
router.get("/:id/transfer", requireAuth, asyncHandler(c.getTransfer)); // info rekening transfer
router.post("/:id/proof", requireAuth, ...uploadProof.single("proof"), asyncHandler(c.uploadProof)); // upload bukti bayar
router.post("/:id/cash", requireAuth, asyncHandler(c.payCash));        // bayar tunai di lokasi

// ulasan (hanya setelah booking selesai; pemilik boleh edit dan hapus)
router.get("/:id/review", requireAuth, asyncHandler(rv.get));
router.post("/:id/review", requireAuth, asyncHandler(rv.create));
router.put("/:id/review", requireAuth, asyncHandler(rv.update));
router.delete("/:id/review", requireAuth, asyncHandler(rv.remove));
router.post("/:id/review/image", requireAuth, ...uploadReviewImage.single("image"), asyncHandler(rv.setImage));
router.delete("/:id/review/image", requireAuth, asyncHandler(rv.clearImage));

// ----- Admin -----
router.get("/", requireAuth, requireAdmin, asyncHandler(c.listAll));                  // semua booking
router.patch("/:id/status", requireAuth, requireAdmin, asyncHandler(c.updateStatus)); // ubah status

export default router;