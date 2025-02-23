// backend/routes/tasksRoutes.js
const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
// Se desejar, inclua middleware de autenticação/autorização para proteger as rotas

// Rota para criar uma nova tarefa
router.post('/create', tasksController.createTask);

// Rota para listar todas as tarefas
router.get('/', tasksController.getTasks);

// Rota para atualizar o status de uma tarefa
router.put('/:taskId/status', tasksController.updateTaskStatus);

module.exports = router;
