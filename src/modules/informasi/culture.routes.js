// ===========================================================================
// INFORMASI › EDUKASI BUDAYA (linimasa + paragraf)        Base URL: /api/culture
// ===========================================================================
const express = require("express");
const { requireAuth, requireAdmin } = require("../../middleware/auth");
const { asyncHandler } = require("../../middleware/error");
const c = require("./culture.controller");

const router = express.Router();

router.get("/", c.get);
router.put("/", requireAuth, requireAdmin, asyncHandler(c.update));                    // admin
router.post("/timeline", requireAuth, requireAdmin, asyncHandler(c.addTimeline));      // admin
router.delete("/timeline/:id", requireAuth, requireAdmin, asyncHandler(c.removeTimeline)); // admin

module.exports = router;
