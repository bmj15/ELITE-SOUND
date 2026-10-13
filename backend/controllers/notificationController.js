// backend/controllers/notificationController.js
const nodemailer = require('nodemailer');
const { Notification, Configuration } = require('../models');

// Função auxiliar para obter valor de configuração pelo key
async function getConfigValue(key) {
  const config = await Configuration.findOne({ where: { config_key: key } });
  return config ? config.config_value : null;
}

// Notificações do utilizador autenticado (as mais recentes primeiro)
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 100
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Envia uma notificação automática para um usuário e registra a notificação no banco de dados.
 * Dados esperados no corpo da requisição:
 * - userId (opcional): ID do usuário para registrar a notificação.
 * - userEmail: E-mail do destinatário.
 * - subject: Assunto do e-mail/notificação.
 * - message: Conteúdo da mensagem.
 */
exports.sendAutomaticNotification = async (req, res) => {
  try {
    const { userId, userEmail, subject, message } = req.body;
    if (!userEmail || !subject || !message) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    // Obter configurações de e-mail do banco de dados
    const emailUser = await getConfigValue('EMAIL_USER');
    const emailPass = await getConfigValue('EMAIL_PASS');

    if (!emailUser || !emailPass) {
      return res.status(500).json({ error: 'Configurações de e-mail não definidas.' });
    }

    // Configurar o transporte do Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail', // ou outro serviço conforme configurado
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const mailOptions = {
      from: emailUser,
      to: userEmail,
      subject,
      text: message
    };

    // Enviar o e-mail
    await transporter.sendMail(mailOptions);

    // Registrar a notificação no banco de dados (caso o modelo Notification esteja implementado)
    const notification = await Notification.create({
      user_id: userId || null,
      type: subject,
      message,
      is_read: false
    });

    res.json({ message: 'Notificação enviada com sucesso!', notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
