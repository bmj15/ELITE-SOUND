// backend/routes/supplierRoutes.js
const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

router.get('/', supplierController.getSuppliers);
router.post('/create', supplierController.createSupplier);

module.exports = router;
