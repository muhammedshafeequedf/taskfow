import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../middleware/auth.middleware';
import { customerAuthMiddleware } from '../customer-portal/middleware/customerAuth.middleware';

function staffOrCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    void authMiddleware(req, res, next);
    return;
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
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

router.use(staffOrCustomerAuth);

router.post('/', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
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

