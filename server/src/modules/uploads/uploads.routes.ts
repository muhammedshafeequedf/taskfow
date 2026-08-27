import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../middleware/auth.middleware';
import { customerAuthMiddleware } from '../customer-portal/middleware/customerAuth.middleware';
import { ApiError } from '../../utils/ApiError';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
]);

const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
]);

const BLOCKED_EXT = new Set([
  '.html',
  '.htm',
  '.svg',
  '.js',
  '.mjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.xml',
  '.xhtml',
  '.php',
  '.exe',
  '.sh',
  '.bat',
]);

/** Safe for <img> without Authorization header (still no HTML/SVG). */
const PUBLIC_INLINE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function staffOrCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
  if (!token) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }
  if (!authHeader && queryToken) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  const decoded = jwt.decode(token) as { userType?: string } | null;
  if (decoded?.userType === 'customer') {
    void customerAuthMiddleware(req, res, next);
    return;
  }
  void authMiddleware(req, res, next);
}

const router = Router();

const uploadRoot = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) && !BLOCKED_EXT.has(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXT.has(ext) || !ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('File type not allowed'));
      return;
    }
    cb(null, true);
  },
});

function sendUploadFile(req: Request, res: Response) {
  const filename = path.basename(String(req.params.filename ?? ''));
  if (!filename || filename.includes('..')) {
    res.status(400).json({ success: false, message: 'Invalid filename' });
    return;
  }
  const ext = path.extname(filename).toLowerCase();
  if (BLOCKED_EXT.has(ext) || !ALLOWED_EXT.has(ext)) {
    res.status(403).json({ success: false, message: 'File type blocked' });
    return;
  }
  const full = path.join(uploadRoot, filename);
  if (!full.startsWith(uploadRoot) || !fs.existsSync(full)) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const inline = PUBLIC_INLINE_EXT.has(ext) || ext === '.pdf' || ext === '.mp4' || ext === '.webm';
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
  res.sendFile(full);
}

/** Public read for raster images only (needed by <img>); everything else requires auth. */
router.get('/:filename', (req: Request, res: Response, next: NextFunction) => {
  const filename = path.basename(String(req.params.filename ?? ''));
  const ext = path.extname(filename).toLowerCase();
  if (PUBLIC_INLINE_EXT.has(ext)) {
    sendUploadFile(req, res);
    return;
  }
  staffOrCustomerAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    sendUploadFile(req, res);
  });
});

router.post('/', staffOrCustomerAuth, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    next();
  });
}, (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }

  const publicPath = `/api/uploads/${encodeURIComponent(req.file.filename)}`;

  res.status(201).json({
    success: true,
    data: {
      url: publicPath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

export const uploadsRoutes = router;
