import { Router } from 'express';
import { GuestController } from './guest.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// Public guest registration
router.post('/register', GuestController.register);

// Authenticated guest endpoints
router.use(requireAuth, requireRole('GUEST'));

router.get('/bookings', GuestController.getMyBookings);
router.get('/bookings/:id', GuestController.getBookingDetail);
router.post('/bookings/:id/cancel', GuestController.cancelBooking);
router.post('/bookings/:bookingId/review', GuestController.submitReview);

router.get('/profile', GuestController.getProfile);
router.patch('/profile', GuestController.updateProfile);

router.get('/saved-properties', GuestController.getSavedProperties);
router.post('/saved-properties/:propertyId', GuestController.saveProperty);
router.delete('/saved-properties/:propertyId', GuestController.unsaveProperty);

export const guestRoutes = router;
