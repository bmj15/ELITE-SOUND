// backend/server.js
const express = require('express');
const app = express();
require('dotenv').config();

app.use(express.json());
// Outros middlewares (ex.: cors, body-parser) podem ser adicionados aqui

// Importação das rotas existentes
const emailRoutes = require('./routes/emailRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const priceCalculationRoutes = require('./routes/priceCalculationRoutes');
const logicPOSRoutes = require('./routes/logicPOSRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const cashbackRoutes = require('./routes/cashbackRoutes');
const documentProcessingRoutes = require('./routes/documentProcessingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const configRoutes = require('./routes/configRoutes');
const advancedDiscountRoutes = require('./routes/advancedDiscountRoutes');
const auditRoutes = require('./routes/auditRoutes');
const socialSecurityRoutes = require('./routes/socialSecurityRoutes');
const purchaseContractRoutes = require('./routes/purchaseContractRoutes');
const qrcodeRoutes = require('./routes/qrcodeRoutes');
const tasksRoutes = require('./routes/tasksRoutes');
const faqRoutes = require('./routes/faqRoutes');
const equipmentCompareRoutes = require('./routes/equipmentCompareRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const reimbursementsRoutes = require('./routes/reimbursementsRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const specialOffersRoutes = require('./routes/specialOffersRoutes');
const commissionRoutes = require('./routes/commissionRoutes');
const profitDistributionRoutes = require('./routes/profitDistributionRoutes');

// Registro das rotas na API
app.use('/api/emails', emailRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', priceCalculationRoutes);
app.use('/api/logicpos', logicPOSRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cashback', cashbackRoutes);
app.use('/api/documents', documentProcessingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/configurations', configRoutes);
app.use('/api/discounts', advancedDiscountRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/social-security', socialSecurityRoutes);
app.use('/api/purchase-contract', purchaseContractRoutes);
app.use('/api/qrcode', qrcodeRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/equipment', equipmentCompareRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/reimbursements', reimbursementsRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/special-offers', specialOffersRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/profit_distribution', profitDistributionRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
