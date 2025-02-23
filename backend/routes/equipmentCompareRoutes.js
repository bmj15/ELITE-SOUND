// backend/routes/equipmentCompareRoutes.js
const express = require('express');
const router = express.Router();
const equipmentCompareController = require('../controllers/equipmentCompareController');

router.get('/compare', equipmentCompareController.compareEquipments);

module.exports = router;
