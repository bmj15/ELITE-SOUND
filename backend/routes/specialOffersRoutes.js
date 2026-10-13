// backend/routes/specialOffersRoutes.js
const express = require('express');
const router = express.Router();
const { authenticated } = require('../middleware/roles');
const specialOffersController = require('../controllers/specialOffersController');

router.get('/', authenticated, specialOffersController.getSpecialOffers);

module.exports = router;
