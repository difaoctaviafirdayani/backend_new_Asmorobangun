// ===========================================================================
// KOMUNITAS › FORUM DISKUSI        Base URL: /api/forum
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./forum.controller");

const router = express.Router();

router.get("/", c.list);
router.get("/categories", c.categories);
router.get("/:id", c.getOne);

router.post("/", requireAuth, asyncHandler(c.create));                      // buat diskusi (login)
router.post("/:id/replies", requireAuth, asyncHandler(c.reply));            // balas (login)
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));    // moderasi (admin)
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove));   // hapus (admin)

module.exports = router;
