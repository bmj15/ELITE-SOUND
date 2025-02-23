// backend/controllers/priceCalculationController.js
const moment = require('moment');
const { Equipment, Discount, CashbackTransaction, Cashback } = require('../models');

exports.calculatePrice = async (req, res) => {
  try {
    // Dados esperados: equipment_id, pickup_date, return_date, coupon_code (opcional)
    const { equipment_id, pickup_date, return_date, coupon_code } = req.body;
    if (!equipment_id || !pickup_date || !return_date) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    // Buscar os dados do equipamento
    const equipment = await Equipment.findByPk(equipment_id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    // Converter datas usando moment
    const start = moment(pickup_date);
    const end = moment(return_date);
    if (!start.isValid() || !end.isValid() || end <= start) {
      return res.status(400).json({ error: 'Datas inválidas.' });
    }

    // Calcular a duração
    const durationHours = end.diff(start, 'hours', true);
    const durationDays = end.diff(start, 'days', true);
    const durationWeeks = end.diff(start, 'weeks', true);

    // Cálculo do preço base
    let basePrice = 0;
    if (durationHours <= 24) {
      basePrice = equipment.price_hour * durationHours;
    } else if (durationDays <= 7) {
      basePrice = equipment.price_day * Math.ceil(durationDays);
    } else {
      basePrice = equipment.price_week * Math.ceil(durationWeeks);
    }

    // Aplicar desconto se houver cupom válido
    let discountValue = 0;
    if (coupon_code) {
      const discount = await Discount.findOne({ where: { code: coupon_code, is_active: true } });
      if (discount) {
        if (discount.discount_percentage > 0) {
          discountValue = basePrice * (discount.discount_percentage / 100);
        } else if (discount.discount_value > 0) {
          discountValue = discount.discount_value;
        }
      }
    }

    // Preço final após o desconto
    const finalPrice = basePrice - discountValue;

    // Cálculo de Cashback: suponha um percentual fixo de 5%
    const cashbackPercentage = 5;
    const cashbackAmount = finalPrice * (cashbackPercentage / 100);

    res.json({
      basePrice,
      discountValue,
      finalPrice,
      cashbackAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.registerCashback = async (req, res) => {
  try {
    // Dados esperados: userId, transaction_type ('earn' ou 'redeem'), amount e description
    const { userId, transaction_type, amount, description } = req.body;
    if (!userId || !transaction_type || !amount) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    // Registrar a transação de cashback
    const transaction = await CashbackTransaction.create({
      user_id: userId,
      transaction_type,
      amount,
      description
    });

    // Atualizar o saldo do cashback
    let cashback = await Cashback.findOne({ where: { user_id: userId } });
    if (!cashback) {
      cashback = await Cashback.create({ user_id: userId, balance: 0 });
    }
    if (transaction_type === 'earn') {
      cashback.balance += parseFloat(amount);
    } else if (transaction_type === 'redeem') {
      cashback.balance -= parseFloat(amount);
    }
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
