// backend/controllers/reviewsController.js
const { Review } = require('../models');

exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.findAll({ order: [['created_at', 'DESC']] });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { order_id, client_id, rating, comment } = req.body;
    if (!order_id || !client_id || !rating) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }
    const review = await Review.create({ order_id, client_id, rating, comment });
    res.json({ message: 'Avaliação criada com sucesso!', review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
