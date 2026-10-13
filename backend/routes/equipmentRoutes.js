// backend/routes/equipmentRoutes.js
const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const { admin } = require('../middleware/roles');

// Catálogo público
router.get('/', equipmentController.getEquipments);
router.get('/:id', equipmentController.getEquipment);

// Gestão do catálogo
router.post('/', admin, equipmentController.createEquipment);
router.put('/:id', admin, equipmentController.updateEquipment);
router.delete('/:id', admin, equipmentController.deleteEquipment);

module.exports = router;
