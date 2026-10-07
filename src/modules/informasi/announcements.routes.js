// ===========================================================================
// INFORMASI › PENGUMUMAN        Base URL: /api/announcements
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./announcements.controller");

const router = express.Router();

router.get("/", c.list);        // daftar pengumuman
router.get("/:id", c.getOne);   // detail pengumuman

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

module.exports = router;