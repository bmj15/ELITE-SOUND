// backend/routes/legalAlertRoutes.js
const express = require('express');
const router = express.Router();
const legalAlertController = require('../controllers/legalAlertController');
const { staff, admin } = require('../middleware/roles');

router.get('/', staff, legalAlertController.getAlerts);
router.post('/', admin, legalAlertController.createAlert);

module.exports = router;
