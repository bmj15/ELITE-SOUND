// backend/controllers/availabilityController.js
const { AvailabilityNotification } = require('../models');

exports.createNotificationRequest = async (req, res) => {
  try {
    const { user_id, equipment_id, desired_date } = req.body;
    if (!user_id || !equipment_id) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }
    const notification = await AvailabilityNotification.create({
      user_id,
      equipment_id,
      desired_date: desired_date || null
    });
    res.json({ message: 'Notificação solicitada com sucesso!', notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
