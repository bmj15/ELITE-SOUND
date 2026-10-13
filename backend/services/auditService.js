// backend/services/auditService.js
const { AuditLog } = require('../models');

// Regista uma ação no log de auditoria. Nunca interrompe a operação principal.
async function log(req, action, changeType, details) {
  try {
    await AuditLog.create({
      user_id: req && req.user ? req.user.id : null,
      action,
      change_type: changeType,
      change_details: typeof details === 'string' ? details : JSON.stringify(details)
    });
  } catch (error) {
    console.error('Erro ao registar auditoria:', error.message);
  }
}

module.exports = { log };
