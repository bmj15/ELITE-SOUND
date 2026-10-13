module.exports = (sequelize, DataTypes) => {
  const FiscalObligation = sequelize.define('FiscalObligation', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    obligation_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount_due: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT
    },
    // pendente | pago
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pendente'
    }
  }, {
    tableName: 'fiscal_obligations'
  });
  return FiscalObligation;
};
