module.exports = (sequelize, DataTypes) => {
  const ProfitShareDividend = sequelize.define('ProfitShareDividend', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    distribution_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    units: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    // a_pagar | paga
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'a_pagar'
    },
    paid_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'profit_share_dividends',
    underscored: true
  });

  ProfitShareDividend.associate = (models) => {
    ProfitShareDividend.belongsTo(models.ProfitDistribution, { foreignKey: 'distribution_id' });
    ProfitShareDividend.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
  };
  return ProfitShareDividend;
};
