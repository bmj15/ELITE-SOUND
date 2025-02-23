// backend/routes/reviewsRoutes.js
const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');

router.get('/', reviewsController.getReviews);
router.post('/create', reviewsController.createReview);

module.exports = router;
