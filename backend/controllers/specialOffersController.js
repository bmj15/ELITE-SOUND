// backend/controllers/specialOffersController.js
const { Order } = require('../models');

exports.getSpecialOffers = async (req, res) => {
  try {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório.' });
    
    // Exemplo simples: se o cliente tiver mais de 3 pedidos, oferece uma oferta especial
    const orders = await Order.findAll({ where: { client_id } });
    let offers = [];
    if (orders.length >= 3) {
      offers.push({
        title: 'Desconto Especial para Clientes Frequentes',
        description: 'Você recebeu 10% de desconto na próxima reserva por ser um cliente frequente!'
      });
    } else {
      offers.push({
        title: 'Sem Ofertas Especiais',
        description: 'Realize mais reservas para desbloquear descontos exclusivos.'
      });
    }
    res.json({ offers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
