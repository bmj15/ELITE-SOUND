// backend/controllers/faqController.js
const { Faq } = require('../models');
const audit = require('../services/auditService');

exports.getFaqs = async (req, res) => {
  try {
    const faqs = await Faq.findAll({ order: [['created_at', 'DESC']] });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createFaq = async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question) return res.status(400).json({ error: 'Pergunta é obrigatória.' });
    const faq = await Faq.create({ question, answer });
    await audit.log(req, 'FAQ criada', 'create', { faq_id: faq.id });
    res.json({ message: 'FAQ criada com sucesso!', faq });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
