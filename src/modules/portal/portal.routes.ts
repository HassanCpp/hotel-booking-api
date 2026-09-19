import { Router } from 'express';
import { PortalController } from './portal.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';
import { tenantGuard } from '../../middleware/tenantGuard';
import { upload } from '../../utils/upload';

const router = Router();

// Require authenticated hotel admin or super admin for all portal operations
router.use(requireAuth, requireRole('HOTEL_ADMIN', 'SUPER_ADMIN'));

// 0. Asset Uploads
router.post('/upload', upload.single('file'), PortalController.uploadImage);

// 1. Amenities Catalog
router.get('/amenities', PortalController.getAmenitiesCatalog);

// 2. Hotel Tenant Information
router.get('/hotel/me', PortalController.getMyHotel);
router.get('/hotels/:hotelId', tenantGuard, PortalController.getHotelById);

// Hotel Profile & Account Management
router.patch('/hotel/me', PortalController.updateMyHotel);
router.post('/account/password', PortalController.changePassword);
router.post('/account/email', PortalController.changeEmail);

// 3. Property Management (Milestone A3)
router.get('/properties', PortalController.getMyProperties);
router.post('/properties', PortalController.createProperty);
router.get('/properties/:id', PortalController.getPropertyById);
router.patch('/properties/:id', PortalController.updateProperty);
router.delete('/properties/:id', PortalController.deleteProperty);
router.post('/properties/:id/publish', PortalController.publishProperty);
router.post('/properties/:id/unpublish', PortalController.unpublishProperty);

// 4. Structured Policies (Milestone A3)
router.get('/properties/:id/policies', PortalController.getPropertyPolicies);
router.put('/properties/:id/policies', PortalController.updatePropertyPolicies);

// 5. Room Type Catalog (Milestone A4)
router.get('/properties/:id/rooms', PortalController.getRoomTypes);
router.post('/properties/:id/rooms', PortalController.createRoomType);
router.patch('/rooms/:roomId', PortalController.updateRoomType);
router.delete('/rooms/:roomId', PortalController.deleteRoomType);

export const portalRoutes = router;
