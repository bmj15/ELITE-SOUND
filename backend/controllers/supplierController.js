// backend/controllers/supplierController.js
const { Supplier } = require('../models');

exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({ order: [['name', 'ASC']] });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const { name, country, tax_id, address, contact_info } = req.body;
    if (!name || !country) {
      return res.status(400).json({ error: 'Nome e país são obrigatórios.' });
    }
    // Define is_in_ue com base no país (exemplo simples: se país for 'Portugal' ou outro da UE)
    const is_in_ue = (country.toLowerCase() !== 'brasil' && country.toLowerCase() !== 'usa');
    const supplier = await Supplier.create({
      name,
      country,
      is_in_ue,
      tax_id,
      address,
      contact_info
    });
    res.json({ message: 'Fornecedor criado com sucesso!', supplier });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
