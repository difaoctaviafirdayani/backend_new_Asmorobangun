// ===========================================================================
// INFORMASI › FAQ (pertanyaan umum)        Base URL: /api/faqs
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import * as c from "../controllers/faqs.controller";
import { validate } from "../middleware/validate";
import { faqCreateSchema, faqUpdateSchema } from "../schemas/content.schema";

const router = Router();

router.get("/", asyncHandler(c.list));
router.post("/", requireAuth, requireAdmin, validate(faqCreateSchema), asyncHandler(c.create));
router.patch("/:id", requireAuth, requireAdmin, validate(faqUpdateSchema), asyncHandler(c.update));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(c.remove)); // admin

export default router;