// backend/routes/faqRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const faqController = require('../controllers/faqController');

router.get('/', faqController.getFaqs);
router.post('/', admin, faqController.createFaq);
router.post('/create', admin, faqController.createFaq);

module.exports = router;
