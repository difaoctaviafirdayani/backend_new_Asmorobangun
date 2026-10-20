const { culture } = require("../../database/content.repo");
const { httpError } = require("../../middleware/error");

exports.get = async (req, res) => {
  res.json({ cultureInfo: await culture.get() });
};

exports.update = async (req, res) => {
  const { timeline, paragraph } = req.body;
  await culture.update({ timeline, paragraph });
  res.json({ message: "Konten edukasi budaya diperbarui." });
};

exports.addTimeline = async (req, res) => {
  const { year, text } = req.body;
  if (!year || !text) throw httpError(400, "Tahun dan keterangan wajib diisi.");
  const point = await culture.addTimeline({ year, text });
  res.status(201).json({ point });
};

exports.removeTimeline = async (req, res) => {
  await culture.removeTimeline(req.params.id);
  res.json({ message: "Poin linimasa dihapus." });
};