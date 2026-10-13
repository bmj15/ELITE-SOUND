module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false
    },
    is_in_ue: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    tax_id: {
      type: DataTypes.STRING
    },
    address: {
      type: DataTypes.TEXT
    },
    contact_info: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'suppliers'
  });
  return Supplier;
};
