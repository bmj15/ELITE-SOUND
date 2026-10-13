// backend/controllers/documentProcessingController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Document } = require('../models');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const STAFF = ['admin', 'collaborator'];
const safe = (s) => String(s).replace(/[^\p{L}\p{N} ._-]/gu, '_').trim();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${safe(file.originalname)}`)
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Middleware para processar o upload
exports.uploadDocument = upload.single('file');

// Guarda o documento. Os metadados (tipo, cliente, número, pedido, data) vêm do formulário;
// em produção podem vir de OCR (ex.: Tesseract.js).
exports.processDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { type = 'Documento', client, number, order_id, date, user_id } = req.body;
    const metadata = { type, client, number, order: order_id, date };

    // Nome descritivo quando há metadados; o prefixo temporal evita nomes repetidos
    const parts = [type, client, number, order_id && `Pedido ${order_id}`, date].filter(Boolean).map(safe);
    const extension = path.extname(req.file.originalname);
    const newFileName = parts.length > 1
      ? `${Date.now()}-${parts.join(' - ')}${extension}`
      : req.file.filename;
    fs.renameSync(req.file.path, path.join(UPLOAD_DIR, newFileName));

    const document = await Document.create({
      user_id: user_id || null,
      order_id: order_id || null,
      type,
      file_name: newFileName,
      file_path: '',
      metadata,
      uploaded_by: req.user.id
    });
    await document.update({ file_path: `/api/documents/${document.id}/file` });

    res.json({ message: 'Documento guardado com sucesso!', newFileName, document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cliente: os seus documentos. Equipa: todos.
exports.getMyDocuments = async (req, res) => {
  try {
    const where = STAFF.includes(req.user.role) ? {} : { user_id: req.user.id };
    const documents = await Document.findAll({ where, order: [['uploaded_at', 'DESC']] });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Descarrega o ficheiro (só o dono do documento ou a equipa)
exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document || (!STAFF.includes(req.user.role) && Number(document.user_id) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    const filePath = path.join(UPLOAD_DIR, path.basename(document.file_name));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Ficheiro não encontrado.' });
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
