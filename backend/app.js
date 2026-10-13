// backend/app.js
// Aplicação Express: API em /api e o site (public_html) servido na mesma origem.
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

const routes = {
  '/api/emails': './routes/emailRoutes',
  '/api/users': './routes/userRoutes',
  '/api/equipments': './routes/equipmentRoutes',
  '/api/orders': ['./routes/orderRoutes', './routes/priceCalculationRoutes'],
  '/api/logicpos': './routes/logicPOSRoutes',
  '/api/payments': './routes/paymentRoutes',
  '/api/notifications': './routes/notificationRoutes',
  '/api/cashback': './routes/cashbackRoutes',
  '/api/documents': './routes/documentProcessingRoutes',
  '/api/reports': './routes/reportRoutes',
  '/api/configurations': './routes/configRoutes',
  '/api/discounts': './routes/advancedDiscountRoutes',
  '/api/audit': './routes/auditRoutes',
  '/api/social-security': './routes/socialSecurityRoutes',
  '/api/purchase-contract': './routes/purchaseContractRoutes',
  '/api/purchase_orders': './routes/purchaseOrderRoutes',
  '/api/qrcode': './routes/qrcodeRoutes',
  '/api/tasks': './routes/tasksRoutes',
  '/api/faqs': './routes/faqRoutes',
  '/api/equipment': './routes/equipmentCompareRoutes',
  '/api/suppliers': './routes/supplierRoutes',
  '/api/reimbursements': './routes/reimbursementsRoutes',
  '/api/recommendations': './routes/recommendationRoutes',
  '/api/availability': './routes/availabilityRoutes',
  '/api/special-offers': './routes/specialOffersRoutes',
  '/api/reviews': './routes/reviewsRoutes',
  '/api/employee-contracts': './routes/employeeContractRoutes',
  '/api/chat': './routes/chatRoutes',
  '/api/fiscal_obligations': './routes/fiscalObligationRoutes',
  '/api/legal_alerts': './routes/legalAlertRoutes',
  '/api/commissions': './routes/commissionRoutes',
  '/api/profit_distribution': './routes/profitDistributionRoutes'
};

Object.entries(routes).forEach(([prefix, files]) => {
  [].concat(files).forEach(file => app.use(prefix, require(file)));
});

// Endpoint da API inexistente
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));

// Site
app.use(express.static(path.join(__dirname, '..', 'public_html')));

module.exports = app;
