// backend/controllers/configController.js
const { Configuration } = require('../models');
const audit = require('../services/auditService');

// Retorna todas as configurações
exports.getConfigurations = async (req, res) => {
  try {
    const configs = await Configuration.findAll();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Retorna uma configuração específica pelo config_key
exports.getConfigurationByKey = async (req, res) => {
  try {
    const key = req.params.key;
    const config = await Configuration.findOne({ where: { config_key: key } });
    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Atualiza uma configuração específica pelo config_key
exports.updateConfiguration = async (req, res) => {
  try {
    const key = req.params.key;
    const { config_value } = req.body;
    const config = await Configuration.findOne({ where: { config_key: key } });
    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    config.config_value = config_value;
    await config.save();
    // A password do e-mail nunca vai para o log
    await audit.log(req, 'Configuração alterada', 'update', { key, value: /PASS|TOKEN/i.test(key) ? '***' : config_value });
    res.json({ message: 'Configuração atualizada com sucesso', config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
