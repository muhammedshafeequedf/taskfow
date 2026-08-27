import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/** Staff Atrium routes only — blocks customer-portal JWTs. */
export function requireTaskflowUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }
  const userType = (req.user as { userType?: string }).userType;
  if (userType === 'customer' || req.customerUser) {
    next(new ApiError(403, 'Staff access required'));
    return;
  }
  next();
}

/** Platform admin only (TaskFlow user.role === 'admin'). */
export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }
  const u = req.user as { userType?: string; role?: string };
  if (u.userType === 'customer' || req.customerUser || u.role !== 'admin') {
    next(new ApiError(403, 'Platform admin required'));
    return;
  }
  next();
}
