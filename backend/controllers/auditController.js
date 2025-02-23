// backend/controllers/auditController.js
const { AuditLog } = require('../models');

exports.getAuditLogs = async (req, res) => {
  try {
    // Busca todos os logs, ordenados pela data (mais recentes primeiro)
    const logs = await AuditLog.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
