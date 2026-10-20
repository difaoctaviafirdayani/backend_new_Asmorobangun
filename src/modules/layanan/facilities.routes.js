// ===========================================================================
// LAYANAN › FASILITAS / KELAS + ULASAN        Base URL: /api/facilities
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./facilities.controller");

const router = express.Router();

router.get("/", c.list);
router.get("/:id", c.getOne);
router.post("/:id/reviews", requireAuth, asyncHandler(c.addReview));                       // pengguna login
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));                   // admin (Kelola Kelas)
router.delete("/:facilityId/reviews/:reviewId", requireAuth, requireAdmin, asyncHandler(c.removeReview)); // admin

module.exports = router;
