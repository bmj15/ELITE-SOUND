module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    // Cliente a quem pertence a conversa
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    // user (cliente) | staff (equipa Elite Sound)
    sender: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user'
    },
    sender_id: {
      type: DataTypes.INTEGER.UNSIGNED
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'chat_messages',
    updatedAt: false
  });
  return ChatMessage;
};
