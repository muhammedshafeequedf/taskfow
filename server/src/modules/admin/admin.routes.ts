import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/requirePermission';
import { requireTaskflowUser } from '../../middleware/requireTaskflowUser';
import { asyncHandler } from '../../utils/asyncHandler';
import * as adminController from './admin.controller';
import { TASK_FLOW_PERMISSIONS } from '../../shared/constants/permissions';

const router = Router();

router.use(authMiddleware);
router.use(requireTaskflowUser);
router.use(requirePermission(TASK_FLOW_PERMISSIONS.TASKFLOW.LICENSE.VIEW));
router.get('/license', asyncHandler(adminController.getLicense as Parameters<typeof asyncHandler>[0]));
router.get('/integrations-config', asyncHandler(adminController.getIntegrationsConfig as Parameters<typeof asyncHandler>[0]));

export const adminRoutes = router;
