// backend/routes/commissionRoutes.js
const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const admin = [authMiddleware, authorize('admin')];

// Colaborador: as suas comissões e o progresso nas metas
router.get('/me', authMiddleware, commissionController.getMyCommissions);

// Colaborador: converter comissão em participação nos lucros
router.get('/me/participation', authMiddleware, commissionController.getMyParticipation);
router.post('/:id/convert', authMiddleware, commissionController.convertCommission);

// Regras de comissão
router.get('/rules', admin, commissionController.getRules);
router.post('/rules', admin, commissionController.createRule);
router.put('/rules/:id', admin, commissionController.updateRule);
router.delete('/rules/:id', admin, commissionController.deleteRule);

// Equipa do pedido e recálculo
router.get('/orders/:id/participants', authMiddleware, authorize(['admin', 'collaborator']), commissionController.getParticipants);
router.put('/orders/:id/participants', admin, commissionController.setParticipants);
router.post('/orders/:id/recalculate', admin, commissionController.recalculateOrder);

// Extrato, pagamento e exportação
router.get('/', admin, commissionController.getCommissions);
router.put('/pay', admin, commissionController.payCommissions);
router.get('/export', admin, commissionController.exportCommissions);

module.exports = router;
