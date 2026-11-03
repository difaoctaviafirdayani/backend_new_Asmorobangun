// ===========================================================================
// AI › ANALISIS FORUM (Gemini + verifikasi admin)      Base URL: /api/ai
// Semua endpoint di sini KHUSUS ADMIN (web).
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./analysis.controller";

const router = Router();

router.post("/analyze/thread/:id", requireAuth, requireAdmin, asyncHandler(c.analyzeThread));
router.get("/results", requireAuth, requireAdmin, asyncHandler(c.listResults));
router.patch("/results/:id/verify", requireAuth, requireAdmin, asyncHandler(c.verifyResult));

export default router;