// Exemplo: endpoint para obter o contrato do pedido
exports.getContract = async (req, res) => {
  try {
    const orderId = req.params.id;
    // Lógica para buscar os dados do contrato do pedido no banco de dados
    // Exemplo: suponha que o contrato esteja armazenado como texto no pedido
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    
    // Simulação: contrato fixo ou gerado dinamicamente
    const contractText = `
      <h3>Contrato de Aluguer</h3>
      <p>Este contrato rege o aluguer de equipamentos...</p>
      <p>Cliente: ${order.client_id}</p>
      <p>Data de Levantamento: ${order.pickup_date}</p>
      <p>Data de Devolução: ${order.return_date}</p>
      <p>Termos e Condições...</p>
    `;
    
    res.json({ contractText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exemplo: endpoint para assinar o contrato
exports.signContract = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { signed } = req.body;
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    // Atualiza o status do pedido conforme a lógica de pagamento
    if (signed) {
      // Se a percentagem exigida for 0, o pedido passa a CONFIRMADO, senão para PAGAMENTO_PENDENTE.
      order.status = (order.payment_percentage_required == 0) ? 'CONFIRMADO' : 'PAGAMENTO_PENDENTE';
      order.contract_signed = true;
      await order.save();
    }
    
    res.json({ message: 'Contrato assinado com sucesso', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
