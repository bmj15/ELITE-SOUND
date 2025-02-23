// backend/controllers/reimbursementsController.js
const { Reimbursement } = require('../models');

exports.createReimbursement = async (req, res) => {
  try {
    const { employee_id, amount, iban, description } = req.body;
    if (!employee_id || !amount || !iban) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }
    const reimbursement = await Reimbursement.create({
      employee_id,
      amount,
      iban,
      description,
      status: 'pending'
    });
    res.json({ message: 'Pedido de reembolso criado com sucesso!', reimbursement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReimbursements = async (req, res) => {
  try {
    const reimbursements = await Reimbursement.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(reimbursements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
