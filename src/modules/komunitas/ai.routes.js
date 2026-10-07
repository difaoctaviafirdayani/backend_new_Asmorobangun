// ===========================================================================
// KOMUNITAS › ASISTEN TOPENG (chatbot)        Base URL: /api/ai
// ===========================================================================
const express = require("express");
const { asyncHandler } = require("../../middleware/error");
const c = require("./ai.controller");

const router = express.Router();

router.post("/chat", asyncHandler(c.chat));

module.exports = router;
