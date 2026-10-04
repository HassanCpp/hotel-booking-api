import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { portalRoutes } from './modules/portal/portal.routes';
import { marketplaceRoutes } from './modules/marketplace/marketplace.routes';
import { guestRoutes } from './modules/guest/guest.routes';

const app = express();

app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// Mount module routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/portal', portalRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/guest', guestRoutes);

// Centralized error handling
app.use(errorHandler);

export default app;
