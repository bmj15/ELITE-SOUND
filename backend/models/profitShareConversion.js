module.exports = (sequelize, DataTypes) => {
  const ProfitShareConversion = sequelize.define('ProfitShareConversion', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    commission_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    // Valor da comissão convertido (€)
    amount_eur: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    // Preço da unidade no momento da conversão
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    units: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false
    },
    // Data da conversão: só as unidades convertidas até à data de uma distribuição recebem dividendo
    converted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    // YYYY-MM da conversão (para o limite mensal)
    period: {
      type: DataTypes.STRING(7),
      allowNull: false
    }
  }, {
    tableName: 'profit_share_conversions',
    underscored: true,
    updatedAt: false
  });

  ProfitShareConversion.associate = (models) => {
    ProfitShareConversion.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
    ProfitShareConversion.belongsTo(models.Commission, { foreignKey: 'commission_id' });
  };
  return ProfitShareConversion;
};
