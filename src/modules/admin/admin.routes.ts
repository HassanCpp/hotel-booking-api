import { Router } from 'express';
import { AdminController } from './admin.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// Protect all admin routes with requireAuth and requireRole('SUPER_ADMIN')
router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/stats', AdminController.getStats);
router.get('/hotels', AdminController.listHotels);
router.post('/hotels', AdminController.onboardHotel);
router.get('/hotels/:id', AdminController.getHotelById);
router.patch('/hotels/:id', AdminController.updateHotel);
router.patch('/hotels/:id/status', AdminController.updateHotelStatus);
router.patch('/hotels/:id/admin-password', AdminController.resetHotelAdminPassword);
router.patch('/hotels/:id/admin-email', AdminController.updateHotelAdminEmail);
router.patch('/hotels/:id/admin-profile', AdminController.updateHotelAdminProfile);
router.get('/hotels/:id/activity', AdminController.getHotelActivity);

export const adminRoutes = router;
