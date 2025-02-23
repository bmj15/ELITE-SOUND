// backend/routes/employeeContractRoutes.js
const express = require('express');
const router = express.Router();
const employeeContractController = require('../controllers/employeeContractController');

// Rota para listar contratos de colaboradores
router.get('/', employeeContractController.getContracts);

// Rota para atualizar o status de um contrato
router.put('/:contractId/status', employeeContractController.updateContractStatus);

module.exports = router;
