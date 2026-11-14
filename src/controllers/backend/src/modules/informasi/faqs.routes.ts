// ===========================================================================
// INFORMASI › FAQ (pertanyaan umum)        Base URL: /api/faqs
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "../../controllers/faqs.controller";

const router = Router();

router.get("/", asyncHandler(c.list));
router.post("/", requireAuth, requireAdmin, asyncHandler(c.create));      // admin
router.patch("/:id", requireAuth, requireAdmin, asyncHandler(c.update));  // admin
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;