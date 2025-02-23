// backend/routes/reimbursementsRoutes.js
const express = require('express');
const router = express.Router();
const reimbursementsController = require('../controllers/reimbursementsController');

router.get('/', reimbursementsController.getReimbursements);
router.post('/create', reimbursementsController.createReimbursement);

module.exports = router;
