import multer from 'multer';

// Use memory storage so document buffers can be parsed directly
const storage = multer.memoryStorage();

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['text/plain', 'application/pdf'];
  const ext = file.originalname.toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    ext.endsWith('.txt') ||
    ext.endsWith('.pdf')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only .txt and searchable .pdf files are accepted.'));
  }
};

export const knowledgeUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
