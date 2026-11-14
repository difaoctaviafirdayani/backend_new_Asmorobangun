// ===========================================================================
// NOTIFIKASI PUSH (token perangkat)      Base URL: /api/notifications
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/error";
import * as c from "../../controllers/notifications.controller";

const router = Router();

router.post("/token", requireAuth, asyncHandler(c.registerToken));
router.delete("/token", requireAuth, asyncHandler(c.unregisterToken));

export default router;