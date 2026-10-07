// ===========================================================================
// INFORMASI › GALERI        Base URL: /api/gallery
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./gallery.controller");

const router = express.Router();

router.get("/", c.list);      // publik, tanpa login
router.get("/:id", c.getOne);

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

module.exports = router;
