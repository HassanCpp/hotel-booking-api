import { Router } from 'express';
import { MarketplaceController } from './marketplace.controller';

const router = Router();

// Public marketplace discovery
router.get('/home-feed', MarketplaceController.getHomeFeed);
router.get('/properties', MarketplaceController.searchProperties);
router.get('/search', MarketplaceController.searchProperties);
router.get('/properties/:slug', MarketplaceController.getPropertyBySlug);
router.get('/properties/:slug/rooms', MarketplaceController.getAvailableRooms);
router.post('/properties/:slug/check-rates', MarketplaceController.checkRates);
router.post('/check-rates', MarketplaceController.checkRates);
router.get('/properties/:slug/reviews', MarketplaceController.getPropertyReviews);
router.get('/cities', MarketplaceController.getAvailableCities);
router.post('/promo/validate', MarketplaceController.validatePromo);
router.post('/validate-promo', MarketplaceController.validatePromo);

// Public booking creation
router.post('/bookings', MarketplaceController.createBooking);

export const marketplaceRoutes = router;
