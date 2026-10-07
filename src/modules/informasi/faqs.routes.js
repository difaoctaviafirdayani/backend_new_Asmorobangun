// ===========================================================================
// INFORMASI › FAQ (pertanyaan umum)        Base URL: /api/faqs
// (data "faqs" sudah ada di db.json tetapi sebelumnya belum punya endpoint)
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./faqs.controller");

const router = express.Router();

router.get("/", c.list);
router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

module.exports = router;
