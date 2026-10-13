// backend/controllers/fiscalObligationController.js
const { FiscalObligation } = require('../models');

exports.getObligations = async (req, res) => {
  try {
    const obligations = await FiscalObligation.findAll({ order: [['due_date', 'ASC']] });
    res.json(obligations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createObligation = async (req, res) => {
  try {
    const { obligation_type, amount_due, due_date, notes } = req.body;
    if (!obligation_type || !due_date) {
      return res.status(400).json({ error: 'Tipo e data limite são obrigatórios.' });
    }
    const obligation = await FiscalObligation.create({ obligation_type, amount_due: amount_due || 0, due_date, notes });
    res.status(201).json({ message: 'Obrigação fiscal registada com sucesso!', obligation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const obligation = await FiscalObligation.findByPk(req.params.id);
    if (!obligation) return res.status(404).json({ error: 'Obrigação não encontrada.' });
    await obligation.update({ status: req.body.status });
    res.json({ message: 'Estado atualizado.', obligation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
