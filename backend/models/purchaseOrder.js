module.exports = (sequelize, DataTypes) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    supplier_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT
    },
    contract_number: {
      type: DataTypes.STRING
    },
    // pendente | aprovado | recebido | cancelado
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pendente'
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED
    }
  }, {
    tableName: 'purchase_orders'
  });

  PurchaseOrder.associate = (models) => {
    PurchaseOrder.belongsTo(models.Supplier, { as: 'supplier', foreignKey: 'supplier_id' });
  };
  return PurchaseOrder;
};
