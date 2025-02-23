// backend/controllers/employeeContractController.js
const { Contract } = require('../models');

// Lista todos os contratos de colaboradores
exports.getContracts = async (req, res) => {
  try {
    const contracts = await Contract.findAll({
      where: { type: 'employment' },
      order: [['created_at', 'DESC']]
    });
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualiza o status de um contrato (ex.: assinou, rejeitou)
exports.updateContractStatus = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { status, comments } = req.body; // status: 'signed', 'rejected'
    const contract = await Contract.findByPk(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato não encontrado.' });
    }
    contract.status = status;
    if (comments) contract.comments = comments;
    await contract.save();
    res.json({ message: 'Status do contrato atualizado com sucesso!', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
