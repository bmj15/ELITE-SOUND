module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    // ID do colaborador responsável
    assigned_to: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Pending | In Progress | Completed
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Pending'
    }
  }, {
    tableName: 'tasks'
  });
  return Task;
};
