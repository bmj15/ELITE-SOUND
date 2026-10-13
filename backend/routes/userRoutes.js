// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticated, admin } = require('../middleware/roles');

// Rotas públicas
router.post('/register', userController.register);
router.post('/login', userController.login);

// Rotas protegidas
router.get('/me', authenticated, userController.getAuthenticatedUser);

// Admin: gestão de utilizadores
router.get('/', admin, userController.getUsers);
router.put('/:id/role', admin, userController.updateRole);

module.exports = router;
