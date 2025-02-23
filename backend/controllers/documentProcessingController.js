// backend/controllers/documentProcessingController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do armazenamento com Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Certifique-se de que a pasta 'uploads' existe
  },
  filename: function (req, file, cb) {
    // Nome temporário: timestamp + nome original
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middleware para processar o upload
exports.uploadDocument = upload.single('file');

exports.processDocument = async (req, res) => {
  try {
    // Verifica se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    
    // Caminho do arquivo enviado
    const filePath = req.file.path;
    
    // Simulação da extração de dados via OCR
    // Em um cenário real, você integraria uma biblioteca de OCR (ex.: Tesseract.js) para extrair os dados
    const extractedData = {
      type: 'Fatura',
      client: 'João Silva Lda',
      number: '12345',
      order: '98765',
      date: '2024-03-10'
    };

    // Gerar novo nome de arquivo com base nos metadados extraídos
    const newFileName = `${extractedData.type} - ${extractedData.client} - ${extractedData.number} - Pedido ${extractedData.order} - ${extractedData.date}${path.extname(req.file.originalname)}`;
    const newFilePath = path.join(path.dirname(filePath), newFileName);

    // Renomeia o arquivo
    fs.renameSync(filePath, newFilePath);

    // Retorna o novo nome e caminho para a interface (ou salva no banco de dados conforme a necessidade)
    res.json({
      message: 'Documento processado e renomeado com sucesso!',
      newFileName,
      newFilePath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
