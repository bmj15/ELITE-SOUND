// backend/controllers/equipmentController.js
const { Equipment } = require('../models');

const FIELDS = ['name', 'description', 'category_id', 'price_hour', 'price_day', 'price_week', 'cost_day', 'image_url', 'active'];
const pick = (body) => FIELDS.reduce((acc, f) => (body[f] !== undefined ? { ...acc, [f]: body[f] } : acc), {});

exports.getEquipments = async (req, res) => {
  try {
    const equipments = await Equipment.findAll({ where: { active: true }, order: [['name', 'ASC']] });
    res.json(equipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEquipment = async (req, res) => {
  try {
    const equipment = await Equipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipamento não encontrado.' });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createEquipment = async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'O nome é obrigatório.' });
    const equipment = await Equipment.create(pick(req.body));
    res.status(201).json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEquipment = async (req, res) => {
  try {
    const equipment = await Equipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipamento não encontrado.' });
    await equipment.update(pick(req.body));
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Desativa (não apaga) para manter o histórico dos pedidos
exports.deleteEquipment = async (req, res) => {
  try {
    const equipment = await Equipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipamento não encontrado.' });
    await equipment.update({ active: false });
    res.json({ message: 'Equipamento desativado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
