// backend/controllers/userController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const audit = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const ROLES = ['client', 'collaborator', 'admin'];

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ where: { email: normalizedEmail } })) {
      return res.status(400).json({ error: 'Já existe uma conta com este e-mail.' });
    }
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'client'
    });
    res.status(201).json({ message: 'Conta criada com sucesso.', user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    const user = await User.scope('withPassword').findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    const token = jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuthenticatedUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: lista os utilizadores
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ order: [['name', 'ASC']] });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: muda o papel (cliente, colaborador, admin)
exports.updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Papel inválido.' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    if (user.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Não pode retirar a si próprio o papel de admin.' });
    }
    const previous = user.role;
    await user.update({ role });
    await audit.log(req, 'Alteração de papel', 'update', { user_id: user.id, de: previous, para: role });
    res.json({ message: 'Papel atualizado com sucesso.', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
