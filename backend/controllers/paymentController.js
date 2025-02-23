// backend/controllers/paymentController.js
exports.processPayment = async (req, res) => {
  try {
    // Dados esperados: orderId, amount, cardNumber, expiryDate, cvv
    const { orderId, amount, cardNumber, expiryDate, cvv } = req.body;
    
    // Aqui, simule a verificação do cartão e processamento do pagamento.
    // Em um cenário real, você integraria com um gateway como Stripe, PayPal, etc.
    // Para exemplo, vamos supor que a transação seja sempre aprovada se o número do cartão tiver 16 dígitos.
    
    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      return res.status(400).json({ error: 'Número do cartão inválido.' });
    }
    
    // Simulação de processamento: aguarde 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Aqui você atualizaria o status do pedido e registraria o pagamento no banco de dados.
    // Por simplicidade, retornamos apenas uma mensagem de sucesso.
    res.json({ message: 'Pagamento processado com sucesso para o pedido ' + orderId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
