const express = require("express");
const { nanoid } = require("nanoid");
const { readDB, update } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const db = readDB();
  res.json({ announcements: [...db.announcements].sort((a, b) => new Date(b.date) - new Date(a.date)) });
});

router.get("/:id", (req, res) => {
  const db = readDB();
  const item = db.announcements.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Pengumuman tidak ditemukan." });
  res.json({ announcement: item });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { title, body, type, color, image } = req.body;
  if (!title || !body) return res.status(400).json({ error: "Judul dan isi pengumuman wajib diisi." });
  const item = {
    id: `an-${nanoid(8)}`,
    title,
    body,
    type: type || "Pengumuman",
    color: color || "brown",
    image: image || null,
    date: new Date().toISOString(),
  };
  await update((data) => data.announcements.push(item));
  res.status(201).json({ announcement: item });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const db = readDB();
  const item = db.announcements.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Pengumuman tidak ditemukan." });
  await update((data) => {
    Object.assign(data.announcements.find((a) => a.id === req.params.id), req.body);
  });
  res.json({ message: "Pengumuman diperbarui." });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await update((data) => {
    data.announcements = data.announcements.filter((a) => a.id !== req.params.id);
  });
  res.json({ message: "Pengumuman dihapus." });
});

module.exports = router;
