module.exports = (sequelize, DataTypes) => {
  const Reimbursement = sequelize.define('Reimbursement', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    employee_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    iban: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    // pending | approved | rejected | paid
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending'
    }
  }, {
    tableName: 'reimbursements'
  });
  return Reimbursement;
};
