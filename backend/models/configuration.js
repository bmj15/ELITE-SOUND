module.exports = (sequelize, DataTypes) => {
  const Configuration = sequelize.define('Configuration', {
    id: { 
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true 
    },
    config_key: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true 
    },
    config_value: { 
      type: DataTypes.TEXT 
    }
  }, {
    tableName: 'configurations',
    timestamps: false  // ou true se desejar ter createdAt/updatedAt
  });
  return Configuration;
};
