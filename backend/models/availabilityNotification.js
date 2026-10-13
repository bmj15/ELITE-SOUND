module.exports = (sequelize, DataTypes) => {
  const AvailabilityNotification = sequelize.define('AvailabilityNotification', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    equipment_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    desired_date: {
      type: DataTypes.DATE
    },
    notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'availability_notifications'
  });
  return AvailabilityNotification;
};
