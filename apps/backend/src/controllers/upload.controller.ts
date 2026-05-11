import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { apiError } from '../utils/errors';

const UPLOAD_DIR = process.env.BLOG_IMAGES_DIR
  ? path.resolve(process.env.BLOG_IMAGES_DIR)
  : path.resolve(__dirname, '../../../../apps/web/public/blog/images');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

/** Validate image magic bytes — JPEG, PNG, WebP, AVIF */
function isValidImageMagic(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // WebP: RIFF....WEBP
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
  // AVIF: ....ftypavif or ....ftypavis
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return true;
  }
  return false;
}
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Only JPEG, PNG, WebP and AVIF images are allowed'), '');
    }
    const name = crypto.randomBytes(12).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP and AVIF images are allowed'));
    }
  },
}).single('image');

export function uploadBlogImage(req: Request, res: Response, next: NextFunction) {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json(apiError('FILE_TOO_LARGE', 'Image must be under 5 MB'));
      }
      return res.status(400).json(apiError('UPLOAD_ERROR', err.message));
    }
    if (err) {
      return res.status(400).json(apiError('UPLOAD_ERROR', err.message));
    }

    if (!req.file) {
      return res.status(400).json(apiError('NO_FILE', 'No image file provided'));
    }

    // Validate file content via magic bytes (not just MIME type from client)
    const header = fs.readFileSync(req.file.path).subarray(0, 12);
    if (!isValidImageMagic(header)) {
      // Remove the invalid file
      fs.unlinkSync(req.file.path);
      return res.status(400).json(apiError('INVALID_FILE', 'File content does not match an allowed image type'));
    }

    const publicPath = `/blog/images/${req.file.filename}`;
    return res.json({ ok: true, url: publicPath });
  });
}
