const { nanoid } = require("nanoid");
const { readDB, update } = require("../../database/db");
const { httpError } = require("../../middleware/error");

exports.get = (req, res) => {
  res.json({ cultureInfo: readDB().cultureInfo });
};

exports.update = async (req, res) => {
  const { timeline, paragraph } = req.body;
  await update((data) => {
    if (Array.isArray(timeline)) data.cultureInfo.timeline = timeline;
    if (typeof paragraph === "string") data.cultureInfo.paragraph = paragraph;
    data.cultureInfo.updatedAt = new Date().toISOString();
  });
  res.json({ message: "Konten edukasi budaya diperbarui." });
};

exports.addTimeline = async (req, res) => {
  const { year, text } = req.body;
  if (!year || !text) throw httpError(400, "Tahun dan keterangan wajib diisi.");
  const point = { id: `tl-${nanoid(6)}`, year, text };
  await update((data) => data.cultureInfo.timeline.push(point));
  res.status(201).json({ point });
};

exports.removeTimeline = async (req, res) => {
  await update((data) => {
    data.cultureInfo.timeline = data.cultureInfo.timeline.filter((t) => t.id !== req.params.id);
  });
  res.json({ message: "Poin linimasa dihapus." });
};
