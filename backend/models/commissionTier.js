module.exports = (sequelize, DataTypes) => {
  const CommissionTier = sequelize.define('CommissionTier', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    rule_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    // Volume mensal (base de cálculo acumulada do colaborador) a partir do qual o escalão se aplica
    min_monthly_volume: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    // Bónus pago uma vez por mês ao atingir este escalão
    bonus_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    }
  }, {
    tableName: 'commission_tiers',
    timestamps: false
  });

  CommissionTier.associate = (models) => {
    CommissionTier.belongsTo(models.CommissionRule, { foreignKey: 'rule_id' });
  };
  return CommissionTier;
};
