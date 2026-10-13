module.exports = (sequelize, DataTypes) => {
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    // Cliente a quem o documento pertence
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    order_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    type: {
      type: DataTypes.STRING
    },
    file_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Dados extraídos (tipo, cliente, número, pedido, data)
    metadata: {
      type: DataTypes.JSON
    },
    uploaded_by: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    uploaded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'documents'
  });
  return Document;
};
