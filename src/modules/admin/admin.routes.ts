import { Router } from 'express';
import { AdminController } from './admin.controller';
import { AdminKnowledgeController } from './admin.knowledge.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';
import { knowledgeUpload } from '../../utils/knowledgeUpload';

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
router.get('/hotels/:id/properties', AdminController.getHotelProperties);
router.delete('/properties/:propertyId', AdminController.deleteProperty);
router.delete('/hotels/:id', AdminController.deleteHotel);

// Destinations Curation & Featured Properties CMS
router.get('/destinations', AdminController.listDestinations);
router.post('/destinations', AdminController.createDestination);
router.patch('/destinations/:id', AdminController.updateDestination);
router.delete('/destinations/:id', AdminController.deleteDestination);
router.patch('/properties/:propertyId/feature', AdminController.togglePropertyFeature);

// AI & Vector Knowledge Governance (Super Admin)
router.post('/knowledge/global', knowledgeUpload.single('file'), AdminKnowledgeController.uploadGlobalDocument);
router.get('/knowledge/documents', AdminKnowledgeController.getAllDocuments);
router.get('/knowledge/health', AdminKnowledgeController.getIndexHealth);
router.delete('/knowledge/documents/:id', AdminKnowledgeController.deleteAnyDocument);

// Super Admin Chat Surveillance & Observability
router.get('/knowledge/chat-sessions', AdminKnowledgeController.getChatSessions);
router.get('/knowledge/chat-sessions/:id', AdminKnowledgeController.getChatSessionById);
router.patch('/knowledge/chat-sessions/:id/status', AdminKnowledgeController.updateChatSessionStatus);
router.delete('/knowledge/chat-sessions/:id', AdminKnowledgeController.deleteChatSession);

export const adminRoutes = router;
