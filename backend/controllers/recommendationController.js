// backend/controllers/recommendationController.js
const { Equipment } = require('../models');

exports.getRecommendations = async (req, res) => {
  try {
    const { equipmentId } = req.query;
    if (!equipmentId) {
      return res.status(400).json({ error: 'equipmentId é obrigatório.' });
    }
    // Busca o equipamento consultado para obter sua categoria
    const equipment = await Equipment.findByPk(equipmentId);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }
    // Busca equipamentos da mesma categoria, excluindo o equipamento consultado
    const recommendations = await Equipment.findAll({
      where: {
        category_id: equipment.category_id,
        id: { $ne: equipmentId }
      },
      limit: 3
    });
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
