// backend/scheduler/dailySummaryScheduler.js
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { Order, User, Configuration } = require('../models');

// Função auxiliar para obter um valor de configuração do banco de dados
async function getConfigValue(key) {
  const config = await Configuration.findOne({ where: { config_key: key } });
  return config ? config.config_value : null;
}

// Cria e retorna um transporter do Nodemailer com base nas configurações do banco
async function createTransporter() {
  const emailUser = await getConfigValue('EMAIL_USER');
  const emailPass = await getConfigValue('EMAIL_PASS');
  if (!emailUser || !emailPass) {
    throw new Error('Configurações de e-mail não definidas');
  }
  return nodemailer.createTransport({
    service: 'gmail', // ajuste conforme o seu provedor
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
}

// Função para gerar o resumo diário de pedidos para um determinado cliente
async function generateSummaryForClient(client) {
  // Busque os pedidos ativos e/ou com pagamentos pendentes para este cliente
  const orders = await Order.findAll({
    where: {
      client_id: client.id,
      status: { [Op.in]: ['SUBMETIDO', 'PAGAMENTO_PENDENTE'] }
    }
  });

  if (orders.length === 0) return null;

  let summary = `Olá ${client.name},\n\nSegue o resumo dos seus pedidos atuais:\n\n`;
  orders.forEach(order => {
    summary += `Pedido ID: ${order.id}\nStatus: ${order.status}\nData de Levantamento: ${order.pickup_date}\nData de Devolução: ${order.return_date}\nValor Total: €${order.total_value}\n\n`;
  });
  summary += `\nPor favor, acesse sua conta para mais detalhes.\n\nAtenciosamente,\nEquipe Elite Sound`;
  return summary;
}

// Função para enviar e-mail para um cliente
async function sendEmail(to, subject, text) {
  const transporter = await createTransporter();
  const emailUser = await getConfigValue('EMAIL_USER');

  const mailOptions = {
    from: emailUser,
    to,
    subject,
    text
  };

  return transporter.sendMail(mailOptions);
}

// Função principal para enviar o resumo diário para todos os clientes com pedidos pendentes
async function sendDailySummaries() {
  try {
    // Busque todos os clientes que tenham pedidos ativos ou com pagamento pendente
    // Aqui, por simplicidade, vamos buscar todos os usuários do tipo 'customer'
    const customers = await User.findAll({ where: { role: 'customer' } });
    
    for (const customer of customers) {
      const summary = await generateSummaryForClient(customer);
      if (summary) {
        await sendEmail(
          customer.email,
          'Seu Resumo Diário de Pedidos - Elite Sound',
          summary
        );
        console.log(`Resumo diário enviado para ${customer.email}`);
      }
    }
  } catch (error) {
    console.error('Erro ao enviar resumos diários:', error);
  }
}

// Agenda a tarefa para rodar diariamente às 08:00
cron.schedule('0 8 * * *', () => {
  console.log('Executando o envio do resumo diário de pedidos...');
  sendDailySummaries();
});
