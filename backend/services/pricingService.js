// backend/services/pricingService.js
const moment = require('moment');
const { Discount } = require('../models');

const CASHBACK_PERCENTAGE = 5;
const num = (v) => parseFloat(v) || 0;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

class PricingError extends Error {}

// Preço de aluguer de um equipamento entre duas datas, com cupão opcional.
async function calculateRentalPrice(equipment, pickupDate, returnDate, couponCode) {
  const start = moment(pickupDate);
  const end = moment(returnDate);
  if (!start.isValid() || !end.isValid() || end <= start) throw new PricingError('Datas inválidas.');

  const durationHours = end.diff(start, 'hours', true);
  const durationDays = end.diff(start, 'days', true);
  const durationWeeks = end.diff(start, 'weeks', true);

  let basePrice;
  if (durationHours <= 24) {
    basePrice = num(equipment.price_hour) * durationHours;
  } else if (durationDays <= 7) {
    basePrice = num(equipment.price_day) * Math.ceil(durationDays);
  } else {
    basePrice = num(equipment.price_week) * Math.ceil(durationWeeks);
  }

  let discountValue = 0;
  if (couponCode) {
    const discount = await Discount.findOne({ where: { code: couponCode, is_active: true } });
    if (discount) {
      if (num(discount.discount_percentage) > 0) {
        discountValue = basePrice * (num(discount.discount_percentage) / 100);
      } else if (num(discount.discount_value) > 0) {
        discountValue = num(discount.discount_value);
      }
    }
  }

  const finalPrice = Math.max(0, basePrice - discountValue);
  return {
    basePrice: round2(basePrice),
    discountValue: round2(discountValue),
    finalPrice: round2(finalPrice),
    cashbackAmount: round2(finalPrice * CASHBACK_PERCENTAGE / 100),
    // Custo (sem IVA) do aluguer, usado nas comissões sobre o lucro
    cost: round2(num(equipment.cost_day) * Math.max(1, Math.ceil(durationDays)))
  };
}

module.exports = { PricingError, calculateRentalPrice, CASHBACK_PERCENTAGE };
