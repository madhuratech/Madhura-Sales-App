const multer = require('multer');
const path = require('path');

// Multer Config
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp|gif|pdf|doc|docx|csv|txt|xlsx|xls|zip|rar/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (extname || file.mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only images and documents (pdf, doc, docx, xlsx, xls, csv, txt, zip) are allowed!'));
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter,
});

module.exports = upload;
