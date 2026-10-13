// backend/routes/supplierRoutes.js
const express = require('express');
const router = express.Router();
const { staff } = require('../middleware/roles');
const supplierController = require('../controllers/supplierController');

router.get('/', staff, supplierController.getSuppliers);
router.post('/', staff, supplierController.createSupplier);
router.post('/create', staff, supplierController.createSupplier);

module.exports = router;
