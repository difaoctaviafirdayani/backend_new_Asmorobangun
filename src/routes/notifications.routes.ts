import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import * as c from "../controllers/notifications.controller";

const router = Router();

router.get("/", requireAuth, asyncHandler(c.list));
router.post("/read-all", requireAuth, asyncHandler(c.markAllRead));
router.post("/:id/read", requireAuth, asyncHandler(c.markRead));

router.post("/token", requireAuth, asyncHandler(c.registerToken));
router.delete("/token", requireAuth, asyncHandler(c.unregisterToken));

export default router;
