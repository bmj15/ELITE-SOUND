module.exports = (sequelize, DataTypes) => {
  const CommissionRule = sequelize.define('CommissionRule', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Quando várias regras se aplicam, ganha a de maior prioridade
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    valid_from: {
      type: DataTypes.DATEONLY
    },
    valid_to: {
      type: DataTypes.DATEONLY
    },
    // seller_only | all_participants
    recipient_mode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'seller_only'
    },
    // equal | by_role_weight | custom_percent (só para all_participants)
    split_mode: {
      type: DataTypes.STRING,
      defaultValue: 'equal'
    },
    // Ex.: {"vendedor": 60, "tecnico": 20, "montagem": 20}
    role_weights: {
      type: DataTypes.JSON
    },
    // order_total (com IVA) | order_net (sem IVA) | profit (sem IVA - custo)
    base_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'order_total'
    },
    // percent | fixed_per_sale
    calc_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'percent'
    },
    // Percentagem (calc_type percent) ou valor em € por venda (fixed_per_sale)
    value: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    // Se true, a percentagem vem dos escalões consoante o volume mensal
    use_tiers: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Filtros opcionais
    order_type: {
      type: DataTypes.STRING
    },
    min_order_value: {
      type: DataTypes.DECIMAL(12, 2)
    }
  }, {
    tableName: 'commission_rules',
    underscored: true
  });

  CommissionRule.associate = (models) => {
    CommissionRule.hasMany(models.CommissionTier, { as: 'tiers', foreignKey: 'rule_id', onDelete: 'CASCADE' });
  };
  return CommissionRule;
};
