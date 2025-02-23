// backend/controllers/qrcodeController.js
const QRCode = require('qrcode');

exports.generateQRCode = async (req, res) => {
  try {
    // Suponha que recebemos o ID do pedido na query (ou outro parâmetro)
    const { orderId } = req.query;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId é obrigatório.' });
    }
    
    // Crie uma URL ou mensagem que você deseja codificar no QR Code.
    // Exemplo: uma URL que direcione para o levantamento do pedido.
    const pickupUrl = `https://seusite.com/levantamento.html?orderId=${orderId}`;
    
    // Gere o QR Code como Data URL (base64)
    const qrDataUrl = await QRCode.toDataURL(pickupUrl);
    
    // Retorne o Data URL para o frontend
    res.json({ qrDataUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
