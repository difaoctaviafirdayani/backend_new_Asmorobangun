// ===========================================================================
// INFORMASI › EDUKASI BUDAYA (linimasa + paragraf)        Base URL: /api/culture
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "./culture.controller";

const router = Router();

router.get("/", asyncHandler(c.get));
router.put("/", requireAuth, requireAdmin, asyncHandler(c.update));                         // admin
router.post("/timeline", requireAuth, requireAdmin, asyncHandler(c.addTimeline));           // admin
router.delete("/timeline/:id", requireAuth, requireAdmin, asyncHandler(c.removeTimeline));  // admin

export default router;