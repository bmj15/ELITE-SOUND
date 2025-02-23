// backend/controllers/equipmentCompareController.js
const { Equipment } = require('../models');

exports.compareEquipments = async (req, res) => {
  try {
    const idsParam = req.query.ids; // Ex.: "1,2,3"
    if (!idsParam) return res.status(400).json({ error: 'Parâmetro "ids" é obrigatório.' });
    
    const ids = idsParam.split(',').map(id => parseInt(id));
    const equipments = await Equipment.findAll({
      where: { id: ids }
    });
    res.json(equipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
