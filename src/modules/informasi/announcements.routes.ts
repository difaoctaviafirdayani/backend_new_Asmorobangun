// ===========================================================================
// INFORMASI › PENGUMUMAN        Base URL: /api/announcements
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "../../controllers/announcements.controller";

const router = Router();

router.get("/", asyncHandler(c.list));      // daftar pengumuman
router.get("/:id", asyncHandler(c.getOne)); // detail pengumuman

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;