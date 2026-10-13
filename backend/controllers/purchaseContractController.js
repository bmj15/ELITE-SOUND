// backend/controllers/purchaseContractController.js
const { PurchaseOrder } = require('../models');

// Função auxiliar para gerar um número de contrato
function generateContractNumber() {
  // Gera 7 dígitos aleatórios
  const digits7 = Math.floor(Math.random() * 9000000) + 1000000; // número entre 1000000 e 9999999
  // Gera 2 letras aleatórias
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters =
    letters.charAt(Math.floor(Math.random() * 26)) +
    letters.charAt(Math.floor(Math.random() * 26));
  // Ano atual com 2 dígitos
  const year2 = new Date().getFullYear().toString().slice(-2);
  // Gera 3 dígitos aleatórios
  const digits3 = Math.floor(Math.random() * 900) + 100; // número entre 100 e 999
  return `${digits7}${randomLetters}.${year2}${digits3}`;
}

// Endpoint para gerar contrato para um pedido de compra
exports.generateContractForPurchase = async (req, res) => {
  try {
    const { purchaseOrderId } = req.body;
    if (!purchaseOrderId) {
      return res.status(400).json({ error: 'ID do pedido de compra é obrigatório.' });
    }
    // Busca o pedido de compra (supondo que o modelo PurchaseOrder exista)
    const purchaseOrder = await PurchaseOrder.findByPk(purchaseOrderId);
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Pedido de compra não encontrado.' });
    }
    // Gera o número do contrato
    const contractNumber = generateContractNumber();
    purchaseOrder.contract_number = contractNumber;
    await purchaseOrder.save();

    res.json({ message: 'Contrato gerado com sucesso.', contractNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
