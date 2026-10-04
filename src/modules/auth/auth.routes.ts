import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/login', AuthController.login);
router.post('/google', AuthController.googleLogin);
router.get('/google/config', AuthController.getGoogleConfig);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);

export const authRoutes = router;
