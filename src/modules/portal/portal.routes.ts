import { Router } from 'express';
import { PortalController } from './portal.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';
import { tenantGuard } from '../../middleware/tenantGuard';

const router = Router();

router.use(requireAuth, requireRole('HOTEL_ADMIN', 'SUPER_ADMIN'));

// Scoped to the caller's active hotel
router.get('/hotel/me', PortalController.getMyHotel);
router.get('/properties', PortalController.getMyProperties);

// Target hotel route protected strictly by tenantGuard!
router.get('/hotels/:hotelId', tenantGuard, PortalController.getHotelById);

export const portalRoutes = router;
