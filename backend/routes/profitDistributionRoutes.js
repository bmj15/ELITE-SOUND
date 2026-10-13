// backend/routes/profitDistributionRoutes.js
const express = require('express');
const router = express.Router();
const profitDistributionController = require('../controllers/profitDistributionController');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const admin = [authMiddleware, authorize('admin')];

router.get('/', admin, profitDistributionController.getDistributions);
router.post('/', admin, profitDistributionController.createDistribution);
router.put('/dividends/pay', admin, profitDistributionController.payDividends);

module.exports = router;
