import { Router } from 'express';
import { PortalController } from './portal.controller';
import { PortalKnowledgeController } from './portal.knowledge.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';
import { tenantGuard } from '../../middleware/tenantGuard';
import { upload } from '../../utils/upload';
import { knowledgeUpload } from '../../utils/knowledgeUpload';

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

// 3. Property Management
router.get('/properties', PortalController.getMyProperties);
router.post('/properties', PortalController.createProperty);
router.get('/properties/:id', PortalController.getPropertyById);
router.patch('/properties/:id', PortalController.updateProperty);
router.delete('/properties/:id', PortalController.deleteProperty);
router.post('/properties/:id/publish', PortalController.publishProperty);
router.post('/properties/:id/unpublish', PortalController.unpublishProperty);

// 4. Structured Policies
router.get('/properties/:id/policies', PortalController.getPropertyPolicies);
router.put('/properties/:id/policies', PortalController.updatePropertyPolicies);

// 5. Room Type Catalog
router.get('/properties/:id/rooms', PortalController.getRoomTypes);
router.post('/properties/:id/rooms', PortalController.createRoomType);
router.patch('/rooms/:roomId', PortalController.updateRoomType);
router.delete('/rooms/:roomId', PortalController.deleteRoomType);

// 6. Reservations Management
router.get('/bookings', PortalController.getBookings);
router.get('/bookings/today', PortalController.getTodayOps);
router.get('/bookings/:id', PortalController.getBookingById);
router.post('/bookings', PortalController.createManualBooking);
router.patch('/bookings/:id', PortalController.updateBooking);
router.post('/bookings/:id/confirm', PortalController.confirmBooking);
router.post('/bookings/:id/decline', PortalController.declineBooking);
router.post('/bookings/:id/check-in', PortalController.checkInBooking);
router.post('/bookings/:id/check-out', PortalController.checkOutBooking);
router.post('/bookings/:id/cancel', PortalController.cancelBooking);
router.post('/bookings/:id/no-show', PortalController.markNoShow);
router.post('/bookings/:id/send-confirmation', PortalController.resendConfirmation);

// 7. Availability Calendar & Tape Chart
router.get('/availability/:propertyId', PortalController.getAvailabilityCalendar);
router.patch('/availability/:propertyId/:roomTypeId', PortalController.updateAvailability);

// 8. Rate Plans CRUD
router.get('/rate-plans', PortalController.getRatePlans);
router.post('/rate-plans', PortalController.createRatePlan);
router.patch('/rate-plans/:id', PortalController.updateRatePlan);
router.delete('/rate-plans/:id', PortalController.deleteRatePlan);

// 9. Promo Codes CRUD
router.get('/promo-codes', PortalController.getPromoCodes);
router.post('/promo-codes', PortalController.createPromoCode);
router.patch('/promo-codes/:id', PortalController.updatePromoCode);
router.delete('/promo-codes/:id', PortalController.deletePromoCode);

// 10. Reviews Management (Portal)
router.get('/reviews', PortalController.getReviews);
router.post('/reviews/:reviewId/reply', PortalController.replyToReview);

// 11. Revenue & Occupancy Analytics
router.get('/analytics/revenue', PortalController.getRevenueAnalytics);
router.get('/analytics/occupancy', PortalController.getOccupancyAnalytics);

// 12. Knowledge Base & AI RAG Ingestion (Phase 8)
router.post('/knowledge/upload', knowledgeUpload.single('file'), PortalKnowledgeController.uploadDocument);
router.get('/knowledge/documents', PortalKnowledgeController.getDocuments);
router.get('/knowledge/documents/:id/chunks', PortalKnowledgeController.getDocumentChunks);
router.delete('/knowledge/documents/:id', PortalKnowledgeController.deleteDocument);
router.post('/knowledge/test-query', PortalKnowledgeController.testQuery);

export const portalRoutes = router;
