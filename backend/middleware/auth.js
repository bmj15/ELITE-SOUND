// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // O token vem no formato "Bearer <token>"; em links de download pode vir em ?token=
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded; // Armazena as informações decodificadas do usuário para uso nas rotas protegidas
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' });
  }
};

module.exports = authMiddleware;
