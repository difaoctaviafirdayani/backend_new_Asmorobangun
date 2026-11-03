// ===========================================================================
// INFORMASI › GALERI        Base URL: /api/gallery
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./gallery.controller";

const router = Router();

router.get("/", asyncHandler(c.list));     // publik, tanpa login
router.get("/:id", asyncHandler(c.getOne));

router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;