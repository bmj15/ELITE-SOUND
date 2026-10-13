module.exports = (sequelize, DataTypes) => {
  const CashbackTransaction = sequelize.define('CashbackTransaction', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    // earn | redeem
    transaction_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'cashback_transactions'
  });
  return CashbackTransaction;
};
