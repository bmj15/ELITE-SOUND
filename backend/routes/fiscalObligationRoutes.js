// backend/routes/fiscalObligationRoutes.js
const express = require('express');
const router = express.Router();
const fiscalObligationController = require('../controllers/fiscalObligationController');
const { staff } = require('../middleware/roles');

router.get('/', staff, fiscalObligationController.getObligations);
router.post('/', staff, fiscalObligationController.createObligation);
router.put('/:id/status', staff, fiscalObligationController.updateStatus);

module.exports = router;
