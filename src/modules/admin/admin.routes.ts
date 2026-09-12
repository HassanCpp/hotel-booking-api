import { Router } from 'express';
import { AdminController } from './admin.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// Protect all admin routes with requireAuth and requireRole('SUPER_ADMIN')
router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/stats', AdminController.getStats);
router.get('/hotels', AdminController.listHotels);

export const adminRoutes = router;
