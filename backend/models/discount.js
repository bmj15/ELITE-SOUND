module.exports = (sequelize, DataTypes) => {
  const Discount = sequelize.define('Discount', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    discount_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },
    discount_value: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'discounts'
  });
  return Discount;
};
