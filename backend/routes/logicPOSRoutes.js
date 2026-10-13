const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const logicPOSController = require('../controllers/logicPOSController');

// Rota para sincronizar os equipamentos com o LogicPOS
router.get('/sync-equipment', admin, logicPOSController.syncEquipment);

module.exports = router;
