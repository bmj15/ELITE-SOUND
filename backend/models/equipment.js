module.exports = (sequelize, DataTypes) => {
  const Equipment = sequelize.define('Equipment', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    // ID no LogicPOS (sincronização)
    external_id: {
      type: DataTypes.STRING,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    category_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    price_hour: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    price_day: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    price_week: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    // Custo (sem IVA) por dia, usado nas comissões sobre o lucro
    cost_day: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    image_url: {
      type: DataTypes.STRING
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'equipments'
  });
  return Equipment;
};
