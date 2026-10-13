// backend/routes/reimbursementsRoutes.js
const express = require('express');
const router = express.Router();
const { admin, staff } = require('../middleware/roles');
const reimbursementsController = require('../controllers/reimbursementsController');

router.get('/', admin, reimbursementsController.getReimbursements);
router.post('/', staff, reimbursementsController.createReimbursement);
router.post('/create', staff, reimbursementsController.createReimbursement);

module.exports = router;
