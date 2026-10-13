module.exports = (sequelize, DataTypes) => {
  const Faq = sequelize.define('Faq', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    answer: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'faqs'
  });
  return Faq;
};
