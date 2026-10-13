// backend/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const configController = require('../controllers/configController');

// Rota para obter todas as configurações
router.get('/', admin, configController.getConfigurations);

// Rota para obter uma configuração específica pelo key
router.get('/:key', admin, configController.getConfigurationByKey);

// Rota para atualizar uma configuração específica pelo key
router.put('/:key', admin, configController.updateConfiguration);

module.exports = router;
