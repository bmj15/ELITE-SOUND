// backend/controllers/reportController.js
const ExcelJS = require('exceljs');
const { Order } = require('../models');

exports.exportMonthlyReport = async (req, res) => {
  try {
    // Exemplo: Buscar todos os pedidos (você pode filtrar por data para o mês atual)
    const orders = await Order.findAll();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório Mensal');

    // Definir colunas do relatório
    worksheet.columns = [
      { header: 'ID do Pedido', key: 'id', width: 15 },
      { header: 'Cliente', key: 'client_id', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Data de Criação', key: 'created_at', width: 20 },
      { header: 'Data de Levantamento', key: 'pickup_date', width: 20 },
      { header: 'Data de Devolução', key: 'return_date', width: 20 },
      { header: 'Valor Total (€)', key: 'total_value', width: 15 }
    ];

    // Adicionar os dados de cada pedido
    orders.forEach(order => {
      worksheet.addRow({
        id: order.id,
        client_id: order.client_id,
        status: order.status,
        created_at: order.created_at ? new Date(order.created_at).toLocaleString() : '',
        pickup_date: order.pickup_date ? new Date(order.pickup_date).toLocaleString() : '',
        return_date: order.return_date ? new Date(order.return_date).toLocaleString() : '',
        total_value: order.total_value
      });
    });

    // Configurar o cabeçalho da resposta para download do arquivo Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_mensal.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
