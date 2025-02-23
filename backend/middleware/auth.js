// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }
  
  // O token normalmente vem no formato "Bearer <token>"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token inválido.' });
  }

  try {
    // Substitua 'your_jwt_secret' por sua chave secreta; idealmente, ela deve ser armazenada em uma variável de ambiente
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded; // Armazena as informações decodificadas do usuário para uso nas rotas protegidas
    next();
  } catch (error) {
    return res.status(400).json({ error: 'Token inválido.' });
  }
};

module.exports = authMiddleware;
