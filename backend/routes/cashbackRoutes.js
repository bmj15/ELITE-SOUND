// backend/routes/cashbackRoutes.js
const express = require('express');
const router = express.Router();
const { authenticated } = require('../middleware/roles');
const cashbackController = require('../controllers/cashbackController');

router.post('/apply', authenticated, cashbackController.applyCashback);

module.exports = router;
