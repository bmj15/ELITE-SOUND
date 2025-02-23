// backend/controllers/socialSecurityController.js
const { User, EmploymentContract } = require('../models');

// Atualiza o status de isenção de Segurança Social do usuário
exports.updateExemptionStatus = async (req, res) => {
  try {
    const { userId, isExempt } = req.body;
    if (typeof isExempt === 'undefined') {
      return res.status(400).json({ error: 'O status de isenção é obrigatório.' });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    user.is_social_security_exempt = isExempt;
    await user.save();
    res.json({ message: 'Status de isenção atualizado com sucesso.', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Adiciona dados do contrato de trabalho para o usuário
exports.addEmploymentContract = async (req, res) => {
  try {
    const { userId, employer_name, start_date, contract_type } = req.body;
    if (!userId || !employer_name || !start_date || !contract_type) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    // Cria um novo contrato de trabalho associado ao usuário
    const contract = await EmploymentContract.create({
      employee_id: userId,
      employer_name,
      start_date,
      contract_type,
      status: 'pendente'
    });
    res.json({ message: 'Contrato de trabalho adicionado com sucesso.', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
