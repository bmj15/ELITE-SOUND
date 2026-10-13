module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    // Vendedor responsável pela venda (recebe a comissão nas regras "só vendedor")
    seller_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    // aluguer | venda | servico
    order_type: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.STRING
    },
    pickup_date: {
      type: DataTypes.DATE
    },
    return_date: {
      type: DataTypes.DATE
    },
    // Valor total com IVA
    total_value: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    vat_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 23
    },
    // Custo (sem IVA) dos equipamentos/serviços, usado nas comissões sobre o lucro
    cost_total: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    amount_paid: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    payment_percentage_required: {
      type: DataTypes.DECIMAL(5, 2)
    },
    contract_signed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'orders',
    underscored: true
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, { as: 'seller', foreignKey: 'seller_id' });
    Order.hasMany(models.OrderParticipant, { as: 'participants', foreignKey: 'order_id' });
    Order.hasMany(models.Commission, { as: 'commissions', foreignKey: 'order_id' });
  };
  return Order;
};
