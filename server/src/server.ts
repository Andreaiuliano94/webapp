// server/src/server.ts

import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/error';
import { corsOptions } from './config/corsConfig';
import { configureSocket } from './config/socketConfig';
import { setupSocketHandlers } from './socket';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import messageRoutes from './routes/messageRoutes';
import { authenticateJWT } from './middlewares/auth';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = configureSocket(server);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rimuoviamo helmet e compression che causano problemi
// app.use(helmet({
//   contentSecurityPolicy: false // Disable CSP for development
// }));
// app.use(compression());

// Rimuoviamo morgan che causa problemi
// app.use(morgan('dev'));

// Make sure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateJWT, userRoutes);
app.use('/api/messages', authenticateJWT, messageRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Set up socket handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server, io };