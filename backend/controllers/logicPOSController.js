const axios = require('axios');
const { Configuration, Equipment } = require('../models');

/**
 * Função para buscar as configurações do LogicPOS do banco de dados.
 */
async function getLogicPOSConfig() {
  // Supondo que você tenha configurado as chaves no dashboard:
  // LOGICPOS_API_URL e LOGICPOS_API_TOKEN
  const urlConfig = await Configuration.findOne({ where: { config_key: 'LOGICPOS_API_URL' } });
  const tokenConfig = await Configuration.findOne({ where: { config_key: 'LOGICPOS_API_TOKEN' } });
  return {
    apiUrl: urlConfig ? urlConfig.config_value : null,
    apiToken: tokenConfig ? tokenConfig.config_value : null,
  };
}

/**
 * Endpoint para sincronizar os equipamentos com o LogicPOS.
 * Faz uma requisição para a API externa e, opcionalmente, atualiza a base de dados.
 */
exports.syncEquipment = async (req, res) => {
  try {
    const { apiUrl, apiToken } = await getLogicPOSConfig();
    if (!apiUrl || !apiToken) {
      return res.status(500).json({ error: 'Configuração do LogicPOS não definida.' });
    }

    // Realiza a chamada à API externa
    const response = await axios.get(`${apiUrl}/equipments`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });
    const equipmentData = response.data;

    // Exemplo: Atualizar ou criar registros no banco de dados com base nos dados externos.
    // Essa parte pode ser personalizada conforme a estrutura dos dados.
    if (Array.isArray(equipmentData)) {
      for (const eq of equipmentData) {
        // Supondo que o objeto eq contenha { external_id, name, description, price_day, ... }
        // Você pode usar "findOrCreate" ou "upsert" para atualizar a base de dados.
        await Equipment.upsert({
          external_id: eq.id,  // supondo que você adicione um campo "external_id" no modelo Equipment
          name: eq.name,
          description: eq.description,
          price_day: eq.price_day,
          // ... outros campos conforme necessário
        });
      }
    }

    res.json({ message: 'Sincronização de equipamentos realizada com sucesso.', equipment: equipmentData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
