// ===========================================================================
// INFORMASI › ARTIKEL / BERITA        Base URL: /api/articles
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./articles.controller");

const router = express.Router();

router.get("/", c.list);                    // daftar artikel (?q= &category= &limit=)
router.get("/categories", c.categories);    // daftar kategori
router.get("/:slug", c.getOne);             // detail (slug atau id)

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

module.exports = router;
