// backend/controllers/chatController.js
const { ChatMessage } = require('../models');

const STAFF = ['admin', 'collaborator'];

// Cliente: a sua conversa. Equipa: conversa de um cliente (?user_id=) ou as últimas mensagens.
exports.getMessages = async (req, res) => {
  try {
    const isStaff = STAFF.includes(req.user.role);
    const where = isStaff ? (req.query.user_id ? { user_id: req.query.user_id } : {}) : { user_id: req.user.id };
    const messages = await ChatMessage.findAll({ where, order: [['created_at', 'ASC'], ['id', 'ASC']], limit: 500 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'A mensagem está vazia.' });

    const isStaff = STAFF.includes(req.user.role);
    if (isStaff && !req.body.user_id) {
      return res.status(400).json({ error: 'Indique o cliente (user_id) a quem responde.' });
    }
    const chatMessage = await ChatMessage.create({
      user_id: isStaff ? req.body.user_id : req.user.id,
      sender: isStaff ? 'staff' : 'user',
      sender_id: req.user.id,
      message
    });
    res.status(201).json(chatMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
