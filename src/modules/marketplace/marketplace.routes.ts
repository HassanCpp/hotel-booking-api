import { Router } from 'express';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceKnowledgeController } from './marketplace.knowledge.controller';
import { optionalAuth } from '../../middleware/auth';

const router = Router();

// Public marketplace discovery
router.get('/home-feed', MarketplaceController.getHomeFeed);
router.get('/properties', MarketplaceController.searchProperties);
router.get('/search', MarketplaceController.searchProperties);
router.get('/properties/:slug', MarketplaceController.getPropertyBySlug);
router.get('/properties/:slug/rooms', MarketplaceController.getAvailableRooms);
router.get('/properties/:slug/availability', MarketplaceController.getPropertyAvailability);
router.post('/properties/:slug/check-rates', MarketplaceController.checkRates);
router.post('/check-rates', MarketplaceController.checkRates);
router.get('/properties/:slug/reviews', MarketplaceController.getPropertyReviews);
router.get('/cities', MarketplaceController.getAvailableCities);
router.post('/promo/validate', MarketplaceController.validatePromo);
router.post('/validate-promo', MarketplaceController.validatePromo);

// Public booking creation (with optional guest auth decoding)
router.post('/bookings', optionalAuth, MarketplaceController.createBooking);

// AI Property Concierge RAG Inquiry (Public with optional guest auth)
router.post('/properties/:propertyId/ask', optionalAuth, MarketplaceKnowledgeController.askPropertyConcierge);

export const marketplaceRoutes = router;
