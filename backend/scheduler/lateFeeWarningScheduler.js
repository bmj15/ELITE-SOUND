// backend/scheduler/lateFeeWarningScheduler.js
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { Order, User, Configuration } = require('../models');

async function getConfigValue(key) {
  const config = await Configuration.findOne({ where: { config_key: key } });
  return config ? config.config_value : null;
}

async function createTransporter() {
  const emailUser = await getConfigValue('EMAIL_USER');
  const emailPass = await getConfigValue('EMAIL_PASS');
  if (!emailUser || !emailPass) throw new Error('Configurações de e-mail não definidas');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass }
  });
}

async function sendLateFeeWarning() {
  try {
    // Considera pedidos cuja data de devolução esteja entre agora e daqui a 2 horas
    const now = new Date();
    const threshold = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const orders = await Order.findAll({
      where: {
        status: 'CONFIRMADO',
        return_date: { [Op.between]: [now, threshold] }
      },
      include: [{ model: User, as: 'client' }]
    });
    if (!orders.length) return;
    const transporter = await createTransporter();
    const emailUser = await getConfigValue('EMAIL_USER');
    for (const order of orders) {
      if (!order.client || !order.client.email) continue;
      const mailOptions = {
        from: emailUser,
        to: order.client.email,
        subject: 'Aviso: Devolução Pendente - Possível Multa',
        text: `Prezado cliente,
Seu pedido ${order.id} possui data de devolução próxima (${new Date(order.return_date).toLocaleString()}).
Por favor, regularize a devolução para evitar multa.
Atenciosamente,
Equipe Elite Sound`
      };
      await transporter.sendMail(mailOptions);
      console.log(`Aviso enviado para ${order.client.email} - Pedido ${order.id}`);
    }
  } catch (error) {
    console.error('Erro ao enviar aviso de multa:', error);
  }
}

// Agenda a tarefa para rodar a cada 30 minutos
cron.schedule('*/30 * * * *', () => {
  console.log('Verificando pedidos para aviso de multa...');
  sendLateFeeWarning();
});
