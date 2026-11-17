// ===========================================================================
// KOMUNITAS › ASISTEN TOPENG (chatbot)        Base URL: /api/ai
// ===========================================================================
import { Router } from "express";
import { asyncHandler } from "../../middleware/error";
import * as c from "../../controllers/ai.controller";

const router = Router();

router.post("/chat", asyncHandler(c.chat));

export default router;