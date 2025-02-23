const express = require('express');
const router = express.Router();
const logicPOSController = require('../controllers/logicPOSController');

// Rota para sincronizar os equipamentos com o LogicPOS
router.get('/sync-equipment', logicPOSController.syncEquipment);

module.exports = router;
