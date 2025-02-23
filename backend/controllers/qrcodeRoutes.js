// backend/routes/qrcodeRoutes.js
const express = require('express');
const router = express.Router();
const qrcodeController = require('../controllers/qrcodeController');

// Endpoint para gerar o QR Code
// Exemplo de URL: /api/qrcode/generate?orderId=123
router.get('/generate', qrcodeController.generateQRCode);

module.exports = router;
