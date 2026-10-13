module.exports = (sequelize, DataTypes) => {
  const ProfitDistribution = sequelize.define('ProfitDistribution', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    distribution_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    total_profit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    distributed_amount: {
      type: DataTypes.DECIMAL(12, 2)
    },
    distribution_details: {
      type: DataTypes.TEXT
    },
    // % do lucro que vai para os titulares de unidades de participação
    pool_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },
    pool_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    total_units: {
      type: DataTypes.DECIMAL(14, 4),
      defaultValue: 0
    }
  }, {
    tableName: 'profit_distributions',
    underscored: true
  });

  ProfitDistribution.associate = (models) => {
    ProfitDistribution.hasMany(models.ProfitShareDividend, { as: 'dividends', foreignKey: 'distribution_id' });
  };
  return ProfitDistribution;
};
