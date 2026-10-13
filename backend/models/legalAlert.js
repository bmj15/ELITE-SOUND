module.exports = (sequelize, DataTypes) => {
  const LegalAlert = sequelize.define('LegalAlert', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    alert_date: {
      type: DataTypes.DATEONLY
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'legal_alerts'
  });
  return LegalAlert;
};
