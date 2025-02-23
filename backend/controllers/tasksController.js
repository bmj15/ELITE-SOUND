// backend/controllers/tasksController.js
const { Task, Employee } = require('../models');

// Cria uma nova tarefa
exports.createTask = async (req, res) => {
  try {
    const { title, description, assigned_to, due_date, priority } = req.body;
    if (!title || !assigned_to || !due_date) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }
    
    const task = await Task.create({
      title,
      description,
      assigned_to,
      due_date,
      priority: priority || 0,
      status: 'Pending'
    });
    
    res.json({ message: 'Tarefa criada com sucesso!', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lista todas as tarefas (opcional: filtrar por status ou colaborador)
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      order: [['due_date', 'ASC']]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualiza o status de uma tarefa
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body; // Ex.: 'Pending', 'In Progress', 'Completed'
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }
    task.status = status;
    await task.save();
    res.json({ message: 'Status da tarefa atualizado com sucesso!', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
