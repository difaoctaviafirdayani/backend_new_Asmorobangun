const express = require("express");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const db = readDB();
  res.json({ cultureInfo: db.cultureInfo });
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  const { timeline, paragraph } = req.body;
  await update((data) => {
    if (Array.isArray(timeline)) data.cultureInfo.timeline = timeline;
    if (typeof paragraph === "string") data.cultureInfo.paragraph = paragraph;
    data.cultureInfo.updatedAt = new Date().toISOString();
  });
  res.json({ message: "Konten edukasi budaya diperbarui." });
});

router.post("/timeline", requireAuth, requireAdmin, async (req, res) => {
  const { year, text } = req.body;
  if (!year || !text) return res.status(400).json({ error: "Tahun dan keterangan wajib diisi." });
  const point = { id: `tl-${nanoid(6)}`, year, text };
  await update((data) => data.cultureInfo.timeline.push(point));
  res.status(201).json({ point });
});

router.delete("/timeline/:id", requireAuth, requireAdmin, async (req, res) => {
  await update((data) => {
    data.cultureInfo.timeline = data.cultureInfo.timeline.filter((t) => t.id !== req.params.id);
  });
  res.json({ message: "Poin linimasa dihapus." });
});

module.exports = router;
