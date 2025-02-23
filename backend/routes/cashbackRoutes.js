// backend/routes/cashbackRoutes.js
const express = require('express');
const router = express.Router();
const cashbackController = require('../controllers/cashbackController');

router.post('/apply', cashbackController.applyCashback);

module.exports = router;
