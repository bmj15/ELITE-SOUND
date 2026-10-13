// backend/routes/employeeContractRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const employeeContractController = require('../controllers/employeeContractController');

// Rota para listar contratos de colaboradores
router.get('/', admin, employeeContractController.getContracts);

// Rota para atualizar o status de um contrato
router.put('/:contractId/status', admin, employeeContractController.updateContractStatus);

module.exports = router;
