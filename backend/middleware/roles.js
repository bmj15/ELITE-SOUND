// backend/middleware/roles.js
// Combinações de autenticação + autorização usadas nas rotas.
const authMiddleware = require('./auth');
const authorize = require('./authorize');

module.exports = {
  // Qualquer utilizador autenticado
  authenticated: [authMiddleware],
  // Equipa da Elite Sound
  staff: [authMiddleware, authorize(['admin', 'collaborator'])],
  // Só administradores
  admin: [authMiddleware, authorize('admin')]
};
