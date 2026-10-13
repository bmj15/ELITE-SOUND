// backend/routes/socialSecurityRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const socialSecurityController = require('../controllers/socialSecurityController');

// Rota para atualizar o status de isenção
router.put('/update-exemption', admin, socialSecurityController.updateExemptionStatus);

// Rota para adicionar dados de contrato de trabalho
router.post('/add-contract', admin, socialSecurityController.addEmploymentContract);

module.exports = router;
