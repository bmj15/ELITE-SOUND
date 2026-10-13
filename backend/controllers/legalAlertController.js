// backend/controllers/legalAlertController.js
const { LegalAlert } = require('../models');

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await LegalAlert.findAll({ where: { active: true }, order: [['created_at', 'DESC']] });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAlert = async (req, res) => {
  try {
    const { title, message, alert_date } = req.body;
    if (!message) return res.status(400).json({ error: 'A mensagem é obrigatória.' });
    const alert = await LegalAlert.create({ title, message, alert_date });
    res.status(201).json({ message: 'Aviso criado com sucesso.', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
