module.exports = (sequelize, DataTypes) => {
  const OrderParticipant = sequelize.define('OrderParticipant', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    order_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    // Papel no pedido: vendedor, tecnico, montagem, ...
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Usado quando a regra divide por percentagem personalizada
    custom_percent: {
      type: DataTypes.DECIMAL(5, 2)
    }
  }, {
    tableName: 'order_participants',
    timestamps: false
  });

  OrderParticipant.associate = (models) => {
    OrderParticipant.belongsTo(models.Order, { foreignKey: 'order_id' });
    OrderParticipant.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
  };
  return OrderParticipant;
};
