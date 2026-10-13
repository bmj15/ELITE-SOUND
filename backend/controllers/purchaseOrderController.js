// backend/controllers/purchaseOrderController.js
const { PurchaseOrder, Supplier } = require('../models');

exports.getPurchaseOrders = async (req, res) => {
  try {
    const purchases = await PurchaseOrder.findAll({
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']]
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, total_amount, notes } = req.body;
    if (!supplier_id || !total_amount) {
      return res.status(400).json({ error: 'Fornecedor e valor total são obrigatórios.' });
    }
    if (!(await Supplier.findByPk(supplier_id))) {
      return res.status(400).json({ error: 'Fornecedor não encontrado.' });
    }
    const purchase = await PurchaseOrder.create({ supplier_id, total_amount, notes, created_by: req.user.id });
    res.status(201).json({ message: 'Pedido de compra registado com sucesso!', purchase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const purchase = await PurchaseOrder.findByPk(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Pedido de compra não encontrado.' });
    await purchase.update({ status: req.body.status });
    res.json({ message: 'Estado atualizado.', purchase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
