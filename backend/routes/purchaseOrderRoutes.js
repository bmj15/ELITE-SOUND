// backend/routes/purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { staff } = require('../middleware/roles');

router.get('/', staff, purchaseOrderController.getPurchaseOrders);
router.post('/', staff, purchaseOrderController.createPurchaseOrder);
router.put('/:id/status', staff, purchaseOrderController.updateStatus);

module.exports = router;
