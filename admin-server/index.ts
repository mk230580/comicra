import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import subscriptionsRoutes from './routes/subscriptions';
import analyticsRoutes from './routes/analytics';
import contentRoutes from './routes/content';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Middleware
app.use(cors({
  origin: process.env.ADMIN_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'admin-backend',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/content', contentRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`[admin-backend] Server running on port ${PORT}`);
  console.log(`[admin-backend] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
