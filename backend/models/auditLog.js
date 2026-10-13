module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // create | update | delete | payment | ...
    change_type: {
      type: DataTypes.STRING
    },
    change_details: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'audit_logs',
    updatedAt: false
  });
  return AuditLog;
};
