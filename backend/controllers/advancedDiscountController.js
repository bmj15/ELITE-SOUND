// backend/controllers/advancedDiscountController.js
const { Order, Discount } = require('../models');

/**
 * Calcula o valor final de um pedido aplicando regras avançadas de desconto.
 * Regras exemplares:
 * - Se o pagamento for antecipado, aplica um desconto pré-definido (ex.: 10%).
 * - Se houver cupom válido, aplica o desconto percentual ou valor fixo.
 * - Se o pedido for para mais de X dias, pode haver desconto adicional (promoção de pacote).
 *
 * Dados esperados no corpo da requisição:
 * - orderId: ID do pedido.
 * - couponCode (opcional): Código do cupom a ser aplicado.
 * - antecipado: booleano indicando se o pagamento foi antecipado.
 */
exports.applyAdvancedDiscount = async (req, res) => {
  try {
    const { orderId, couponCode, antecipado } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'ID do pedido é obrigatório.' });
    }

    // Buscar o pedido
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    let discountValue = 0;
    let appliedRules = [];

    // Exemplo: Desconto para pagamento antecipado (10%)
    if (antecipado) {
      const antecipadoDiscount = order.total_value * 0.10;
      discountValue += antecipadoDiscount;
      appliedRules.push({ rule: 'Pagamento Antecipado', discount: antecipadoDiscount });
    }

    // Exemplo: Aplicar cupom, se informado
    if (couponCode) {
      // Buscamos o cupom na tabela Discount (o modelo Discount já deve estar implementado)
      const coupon = await Discount.findOne({ where: { code: couponCode, is_active: true } });
      if (coupon) {
        let couponDiscount = 0;
        if (coupon.discount_percentage > 0) {
          couponDiscount = order.total_value * (coupon.discount_percentage / 100);
        } else if (coupon.discount_value > 0) {
          couponDiscount = coupon.discount_value;
        }
        discountValue += couponDiscount;
        appliedRules.push({ rule: `Cupom ${couponCode}`, discount: couponDiscount });
      } else {
        return res.status(400).json({ error: 'Cupom inválido ou inativo.' });
      }
    }

    // Exemplo: Desconto adicional para reservas de longa duração (mais de 7 dias)
    // Aqui, vamos supor que se o pedido tiver mais de 7 dias, aplica-se 5% adicional.
    const diffDays = (new Date(order.return_date) - new Date(order.pickup_date)) / (1000 * 3600 * 24);
    if (diffDays > 7) {
      const longTermDiscount = order.total_value * 0.05;
      discountValue += longTermDiscount;
      appliedRules.push({ rule: 'Reserva de Longa Duração (>7 dias)', discount: longTermDiscount });
    }

    // Calcular o novo valor do pedido
    let finalPrice = order.total_value - discountValue;
    if (finalPrice < 0) finalPrice = 0;

    // Atualizar o pedido (aqui, pode ser necessário registrar o desconto aplicado)
    order.discount_applied = discountValue;
    order.total_value = finalPrice;
    await order.save();

    res.json({
      message: 'Descontos aplicados com sucesso.',
      originalPrice: order.total_value + discountValue,
      discountValue,
      finalPrice,
      appliedRules
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
