// backend/controllers/priceCalculationController.js
const { Equipment, CashbackTransaction, Cashback } = require('../models');
const { PricingError, calculateRentalPrice } = require('../services/pricingService');

exports.calculatePrice = async (req, res) => {
  try {
    // Dados esperados: equipment_id, pickup_date, return_date, coupon_code (opcional)
    const { equipment_id, pickup_date, return_date, coupon_code } = req.body;
    if (!equipment_id || !pickup_date || !return_date) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    const equipment = await Equipment.findByPk(equipment_id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    const { basePrice, discountValue, finalPrice, cashbackAmount } =
      await calculateRentalPrice(equipment, pickup_date, return_date, coupon_code);
    res.json({ basePrice, discountValue, finalPrice, cashbackAmount });
  } catch (error) {
    if (error instanceof PricingError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

exports.registerCashback = async (req, res) => {
  try {
    // Dados esperados: userId, transaction_type ('earn' ou 'redeem'), amount e description
    const { userId, transaction_type, amount, description } = req.body;
    if (!userId || !['earn', 'redeem'].includes(transaction_type) || !amount) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    const transaction = await CashbackTransaction.create({
      user_id: userId,
      transaction_type,
      amount,
      description
    });

    let cashback = await Cashback.findOne({ where: { user_id: userId } });
    if (!cashback) {
      cashback = await Cashback.create({ user_id: userId, balance: 0 });
    }
    const delta = parseFloat(amount) * (transaction_type === 'earn' ? 1 : -1);
    cashback.balance = Math.round((parseFloat(cashback.balance) + delta) * 100) / 100;
    await cashback.save();

    res.json({
      message: 'Cashback registrado com sucesso e saldo atualizado.',
      transaction,
      balance: cashback.balance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
