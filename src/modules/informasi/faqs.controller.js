const { nanoid } = require("nanoid");
const { faqs } = require("../../database/content.repo");
const { httpError } = require("../../middleware/error");

exports.list = async (req, res) => {
  res.json({ faqs: await faqs.list() });
};

exports.create = async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) throw httpError(400, "Pertanyaan dan jawaban wajib diisi.");
  const faq = await faqs.insert({ id: `faq-${nanoid(6)}`, question, answer });
  res.status(201).json({ faq });
};

exports.update = async (req, res) => {
  const { question, answer } = req.body;
  if (!(await faqs.findById(req.params.id))) throw httpError(404, "FAQ tidak ditemukan.");
  await faqs.patch(req.params.id, { question, answer });
  res.json({ message: "FAQ diperbarui." });
};

exports.remove = async (req, res) => {
  await faqs.remove(req.params.id);
  res.json({ message: "FAQ dihapus." });
};