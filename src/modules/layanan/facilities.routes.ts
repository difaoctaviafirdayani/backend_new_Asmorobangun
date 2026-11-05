// ===========================================================================
// LAYANAN › FASILITAS / KELAS + ULASAN        Base URL: /api/facilities
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./facilities.controller";

const router = Router();

router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
// Ulasan ditulis lewat /api/bookings/:id/review (hanya setelah booking selesai)
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));                                  // admin (Kelola Kelas)
router.delete("/:facilityId/reviews/:reviewId", requireAuth, requireAdmin, asyncHandler(c.removeReview)); // admin

export default router;