module.exports = (sequelize, DataTypes) => {
  const Commission = sequelize.define('Commission', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    // Nulo nos bónus de escalão
    order_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    rule_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    // Escalão que originou o bónus (só nos tier_bonus)
    tier_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    // Parte da base de cálculo que cabe a este colaborador
    base_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    // Percentagem do colaborador na divisão da equipa
    share_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 100
    },
    percent_applied: {
      type: DataTypes.DECIMAL(5, 2)
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    // Parte da comissão convertida em unidades de participação nos lucros
    converted_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    // sale | tier_bonus
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'sale'
    },
    // pendente | a_pagar | paga | anulada
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pendente'
    },
    // YYYY-MM
    period: {
      type: DataTypes.STRING(7),
      allowNull: false
    },
    paid_at: {
      type: DataTypes.DATE
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'commissions',
    underscored: true
  });

  Commission.associate = (models) => {
    Commission.belongsTo(models.Order, { foreignKey: 'order_id' });
    Commission.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
    Commission.belongsTo(models.CommissionRule, { as: 'rule', foreignKey: 'rule_id' });
  };
  return Commission;
};
