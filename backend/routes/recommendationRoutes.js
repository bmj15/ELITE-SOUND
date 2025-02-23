// backend/routes/recommendationRoutes.js
const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

router.get('/get', recommendationController.getRecommendations);

module.exports = router;
