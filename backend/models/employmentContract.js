module.exports = (sequelize, DataTypes) => {
  const EmploymentContract = sequelize.define('EmploymentContract', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    employee_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    employer_name: {
      type: DataTypes.STRING
    },
    start_date: {
      type: DataTypes.DATEONLY
    },
    contract_type: {
      type: DataTypes.STRING
    },
    // pendente | signed | rejected
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pendente'
    },
    comments: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'employment_contracts'
  });
  return EmploymentContract;
};
