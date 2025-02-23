// backend/controllers/emailController.js
const nodemailer = require('nodemailer');
const { Configuration } = require('../models');

// Função para obter uma configuração pelo key
const getConfigValue = async (key) => {
  const config = await Configuration.findOne({ where: { config_key: key } });
  return config ? config.config_value : null;
};

exports.sendEmailNotification = async (req, res) => {
  try {
    // Obtém as credenciais do banco de dados
    const emailUser = await getConfigValue('EMAIL_USER');
    const emailPass = await getConfigValue('EMAIL_PASS');

    if (!emailUser || !emailPass) {
      return res.status(500).json({ error: 'Configurações de e-mail não definidas' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const { to, subject, text } = req.body;
    const mailOptions = {
      from: emailUser,
      to,
      subject,
      text
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ message: 'E-mail enviado com sucesso!', info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
