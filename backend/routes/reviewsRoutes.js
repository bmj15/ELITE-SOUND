// backend/routes/reviewsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticated } = require('../middleware/roles');
const reviewsController = require('../controllers/reviewsController');

router.get('/', reviewsController.getReviews);
router.post('/create', authenticated, reviewsController.createReview);

module.exports = router;
