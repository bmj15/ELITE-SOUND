// backend/middleware/authorize.js
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    // Supondo que o middleware de autenticação já colocou as informações do usuário em req.user
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }
    
    // Se allowedRoles for uma string, converta para array
    if (typeof allowedRoles === 'string') {
      allowedRoles = [allowedRoles];
    }
    
    // Verifica se o papel do usuário está entre os papéis permitidos
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para acessar este recurso.' });
    }
    
    next();
  };
};

module.exports = authorize; 
