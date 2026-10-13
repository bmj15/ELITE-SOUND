// backend/controllers/profitDistributionController.js
const { ProfitDistribution, ProfitShareDividend, User } = require('../models');
const profitShareService = require('../services/profitShareService');
const audit = require('../services/auditService');
const { CommissionError } = require('../services/commissionService');

function handleError(res, error) {
  const status = error instanceof CommissionError ? 400 : 500;
  res.status(status).json({ error: error.message });
}

// Lista as distribuições com os dividendos pagos aos titulares de participação
exports.getDistributions = async (req, res) => {
  try {
    const distributions = await ProfitDistribution.findAll({
      include: [{
        model: ProfitShareDividend,
        as: 'dividends',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
      }],
      order: [['distribution_date', 'DESC']]
    });
    res.json(distributions);
  } catch (error) {
    handleError(res, error);
  }
};

exports.createDistribution = async (req, res) => {
  try {
    const distribution = await profitShareService.distribute(req.body);
    await audit.log(req, 'Distribuição de lucro', 'create', { distribution_id: distribution.id, total_profit: req.body.total_profit });
    const created = await ProfitDistribution.findByPk(distribution.id, {
      include: [{ model: ProfitShareDividend, as: 'dividends' }]
    });
    res.status(201).json(created);
  } catch (error) {
    handleError(res, error);
  }
};

exports.payDividends = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Indique os dividendos a marcar como pagos.' });
    }
    const paid = await profitShareService.markDividendsPaid(ids);
    await audit.log(req, 'Dividendos pagos', 'payment', { ids: paid.map(d => d.id) });
    res.json({ message: `${paid.length} dividendo(s) marcado(s) como pago(s).`, paid: paid.map(d => d.id) });
  } catch (error) {
    handleError(res, error);
  }
};
