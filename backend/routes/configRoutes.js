// backend/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// Rota para obter todas as configurações
router.get('/', configController.getConfigurations);

// Rota para obter uma configuração específica pelo key
router.get('/:key', configController.getConfigurationByKey);

// Rota para atualizar uma configuração específica pelo key
router.put('/:key', configController.updateConfiguration);

module.exports = router;
