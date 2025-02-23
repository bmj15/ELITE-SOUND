// backend/routes/specialOffersRoutes.js
const express = require('express');
const router = express.Router();
const specialOffersController = require('../controllers/specialOffersController');

router.get('/', specialOffersController.getSpecialOffers);

module.exports = router;
